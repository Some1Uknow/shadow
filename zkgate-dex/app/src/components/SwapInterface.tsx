'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useZKProof } from '@/hooks/useZKProof';
import { useProgram } from '@/hooks/useProgram';
import { BN } from '@coral-xyz/anchor';

interface SwapInterfaceProps {
  onProofGenerated: () => void;
  proofGenerated: boolean;
}

export function SwapInterface({ onProofGenerated, proofGenerated }: SwapInterfaceProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { generateProof, isGenerating, isInitialized, proof, error: proofError } = useZKProof();
  const { program, poolPda, poolConfig } = useProgram();

  const [amountIn, setAmountIn] = useState<string>('');
  const [minOut, setMinOut] = useState<string>('');
  const [swapDirection, setSwapDirection] = useState<'AtoB' | 'BtoA'>('AtoB');
  const [isSwapping, setIsSwapping] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // User token balances
  const [balanceA, setBalanceA] = useState<number>(0);
  const [balanceB, setBalanceB] = useState<number>(0);

  // Fetch user token balances
  useEffect(() => {
    async function fetchBalances() {
      if (!publicKey || !poolConfig) return;

      try {
        // Get user's ATAs
        const userAtaA = await getAssociatedTokenAddress(
          poolConfig.tokenAMint,
          publicKey
        );
        const userAtaB = await getAssociatedTokenAddress(
          poolConfig.tokenBMint,
          publicKey
        );

        // Fetch balances
        try {
          const accountA = await getAccount(connection, userAtaA);
          setBalanceA(Number(accountA.amount) / 1e9);
        } catch {
          setBalanceA(0);
        }

        try {
          const accountB = await getAccount(connection, userAtaB);
          setBalanceB(Number(accountB.amount) / 1e9);
        } catch {
          setBalanceB(0);
        }
      } catch (err) {
        console.error('Error fetching balances:', err);
      }
    }

    fetchBalances();
    // Refresh every 10 seconds
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [publicKey, poolConfig, connection]);

  // Generate ZK proof for eligibility
  const handleGenerateProof = useCallback(async () => {
    if (!publicKey) {
      setError('Connect wallet first');
      return;
    }

    if (!isInitialized) {
      setError('ZK system initializing... please wait');
      return;
    }

    try {
      setError(null);
      // Prove balance >= threshold
      // Use actual token balance for proof
      const userBalance = Math.floor((swapDirection === 'AtoB' ? balanceA : balanceB) * 1000);
      const threshold = 1000; // Minimum 1 token (in millitokens)

      if (userBalance < threshold) {
        setError(`Insufficient balance. Need at least ${threshold / 1000} tokens.`);
        return;
      }

      await generateProof({
        balance: userBalance,
        threshold: threshold,
      });

      onProofGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proof');
    }
  }, [publicKey, isInitialized, generateProof, onProofGenerated, balanceA, balanceB, swapDirection]);

  // Execute the ZK-verified swap
  const handleSwap = useCallback(async () => {
    if (!publicKey || !signTransaction || !program || !proof || !poolConfig) {
      setError('Missing requirements for swap');
      return;
    }

    setIsSwapping(true);
    setError(null);
    setTxSignature(null);

    try {
      const amountInLamports = new BN(Math.floor(parseFloat(amountIn) * 1e9));
      const minOutLamports = new BN(Math.floor(parseFloat(minOut || '0') * 1e9));

      // Compute user's ATAs
      const userTokenA = await getAssociatedTokenAddress(
        poolConfig.tokenAMint,
        publicKey
      );
      const userTokenB = await getAssociatedTokenAddress(
        poolConfig.tokenBMint,
        publicKey
      );

      console.log('Swap accounts:', {
        pool: poolConfig.poolPda.toBase58(),
        userTokenA: userTokenA.toBase58(),
        userTokenB: userTokenB.toBase58(),
        tokenAReserve: poolConfig.tokenAReserve.toBase58(),
        tokenBReserve: poolConfig.tokenBReserve.toBase58(),
        verifierProgram: poolConfig.verifierProgramId.toBase58(),
        verifierState: poolConfig.verifierState.toBase58(),
      });

      // Build the swap instruction (use snake_case method names from IDL)
      const methodName = swapDirection === 'AtoB' ? 'zkSwap' : 'zkSwapReverse';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)[methodName](
        amountInLamports,
        minOutLamports,
        Buffer.from(proof.proof),
        Buffer.from(proof.publicInputs)
      )
        .accounts({
          pool: poolConfig.poolPda,
          userTokenA: userTokenA,
          userTokenB: userTokenB,
          tokenAReserve: poolConfig.tokenAReserve,
          tokenBReserve: poolConfig.tokenBReserve,
          user: publicKey,
          verifierProgram: poolConfig.verifierProgramId,
          verifierState: poolConfig.verifierState,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();

      // Add compute budget instructions for Groth16 verification
      // The gnark verifier uses ~200k CUs, so we request 500k total
      const { ComputeBudgetProgram } = await import('@solana/web3.js');
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 500_000,
      });
      const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1_000,
      });

      // Prepend compute budget instructions to transaction
      tx.instructions.unshift(modifyComputeUnits, addPriorityFee);

      // Sign and send
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      await connection.confirmTransaction(signature, 'confirmed');
      setTxSignature(signature);
    } catch (err) {
      console.error('Swap error:', err);
      setError(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  }, [publicKey, signTransaction, program, proof, amountIn, minOut, poolConfig, connection, swapDirection]);

  // Check if pool is configured
  if (!poolConfig) {
    return (
      <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-semibold mb-4">ZK Swap</h2>
        <div className="text-yellow-400 text-sm p-4 bg-yellow-900/20 rounded-lg">
          <p className="font-semibold mb-2">⚠️ Pool Not Configured</p>
          <p className="text-gray-400">
            Set the following environment variables in <code>.env.local</code>:
          </p>
          <ul className="text-xs mt-2 space-y-1 text-gray-500">
            <li>NEXT_PUBLIC_TOKEN_A_MINT</li>
            <li>NEXT_PUBLIC_TOKEN_B_MINT</li>
            <li>NEXT_PUBLIC_POOL_PDA</li>
            <li>NEXT_PUBLIC_TOKEN_A_RESERVE</li>
            <li>NEXT_PUBLIC_TOKEN_B_RESERVE</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-6">ZK Swap</h2>

      {/* ZK System Status */}
      {!isInitialized && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg text-blue-300 text-sm">
          Initializing ZK proof system...
        </div>
      )}

      {/* Token Balances */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400">Token A Balance</p>
          <p className="text-lg font-mono text-purple-400">{balanceA.toFixed(4)}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400">Token B Balance</p>
          <p className="text-lg font-mono text-pink-400">{balanceB.toFixed(4)}</p>
        </div>
      </div>

      {/* Direction Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSwapDirection('AtoB')}
          className={`flex-1 py-2 rounded-lg transition-colors ${swapDirection === 'AtoB'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
        >
          Token A → B
        </button>
        <button
          onClick={() => setSwapDirection('BtoA')}
          className={`flex-1 py-2 rounded-lg transition-colors ${swapDirection === 'BtoA'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
        >
          Token B → A
        </button>
      </div>

      {/* Input Amount */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Amount In</label>
        <input
          type="number"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          placeholder="0.0"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Min Output */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">
          Minimum Output (slippage protection)
        </label>
        <input
          type="number"
          value={minOut}
          onChange={(e) => setMinOut(e.target.value)}
          placeholder="0.0"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Step 1: Generate Proof */}
      {!proofGenerated && (
        <button
          onClick={handleGenerateProof}
          disabled={isGenerating || !isInitialized}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all mb-4"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              Generating ZK Proof...
            </span>
          ) : (
            'Step 1: Generate ZK Proof'
          )}
        </button>
      )}

      {/* Step 2: Execute Swap */}
      {proofGenerated && (
        <button
          onClick={handleSwap}
          disabled={isSwapping || !amountIn}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all"
        >
          {isSwapping ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              Executing Swap...
            </span>
          ) : (
            'Step 2: Execute ZK Swap'
          )}
        </button>
      )}

      {/* Error Display */}
      {(error || proofError) && (
        <div className="mt-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-300 text-sm">
          {error || proofError}
        </div>
      )}

      {/* Success Display */}
      {txSignature && (
        <div className="mt-4 p-3 bg-green-900/50 border border-green-500/50 rounded-lg">
          <p className="text-green-300 text-sm mb-2">Swap successful!</p>
          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 text-xs break-all"
          >
            View on Explorer →
          </a>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
