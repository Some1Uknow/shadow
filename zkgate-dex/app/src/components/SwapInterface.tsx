'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useZKProof } from '@/hooks/useZKProof';
import { useProgram } from '@/hooks/useProgram';
import { BN } from '@coral-xyz/anchor';

interface SwapInterfaceProps {
  onProofGenerated: () => void;
  proofGenerated: boolean;
}

// Default slippage tolerance: 0.5%
const DEFAULT_SLIPPAGE = 0.9;

export function SwapInterface({ onProofGenerated, proofGenerated }: SwapInterfaceProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { generateProof, isGenerating, isInitialized, proof, error: proofError } = useZKProof();
  const { program, poolPda, poolConfig } = useProgram();

  const [amountIn, setAmountIn] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
  const [swapDirection, setSwapDirection] = useState<'AtoB' | 'BtoA'>('AtoB');
  const [isSwapping, setIsSwapping] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // User token balances
  const [balanceA, setBalanceA] = useState<number>(0);
  const [balanceB, setBalanceB] = useState<number>(0);

  // Pool reserves for price calculation
  const [reserveA, setReserveA] = useState<number>(0);
  const [reserveB, setReserveB] = useState<number>(0);

  // Fetch user token balances and pool reserves
  useEffect(() => {
    async function fetchData() {
      if (!publicKey || !poolConfig) return;

      try {
        const userAtaA = await getAssociatedTokenAddress(poolConfig.tokenAMint, publicKey);
        const userAtaB = await getAssociatedTokenAddress(poolConfig.tokenBMint, publicKey);

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

        // Fetch pool reserves from Pool account state (MUST match what on-chain program uses)
        // The on-chain program uses pool.token_a_reserve and pool.token_b_reserve for AMM calculations,
        // NOT the actual token account balances!
        try {
          if (program && poolConfig.poolPda) {
            // Fetch the Pool account state directly
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const poolAccount = await (program.account as any).pool.fetch(poolConfig.poolPda);
            setReserveA(Number(poolAccount.tokenAReserve) / 1e9);
            setReserveB(Number(poolAccount.tokenBReserve) / 1e9);
          }
        } catch (e) {
          console.error('Error fetching pool reserves:', e);
          // Pool not initialized
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [publicKey, poolConfig, connection, program]);

  // Calculate estimated output using constant product formula
  // Must match on-chain formula exactly: output = (997 * input * reserveOut) / (1000 * reserveIn + 997 * input)
  const estimatedOutput = useMemo(() => {
    const inputAmount = parseFloat(amountIn) || 0;
    if (inputAmount <= 0 || reserveA <= 0 || reserveB <= 0) return 0;

    // Apply 0.3% fee using integer math like on-chain (997/1000)
    const amountInWithFee = inputAmount * 997;

    if (swapDirection === 'AtoB') {
      // Selling Token A for Token B
      const numerator = amountInWithFee * reserveB;
      const denominator = (reserveA * 1000) + amountInWithFee;
      return numerator / denominator;
    } else {
      // Selling Token B for Token A
      const numerator = amountInWithFee * reserveA;
      const denominator = (reserveB * 1000) + amountInWithFee;
      return numerator / denominator;
    }
  }, [amountIn, reserveA, reserveB, swapDirection]);

  // Minimum output with slippage
  const minOutput = useMemo(() => {
    return estimatedOutput * (1 - slippage / 100);
  }, [estimatedOutput, slippage]);

  // Price impact
  const priceImpact = useMemo(() => {
    const inputAmount = parseFloat(amountIn) || 0;
    if (inputAmount <= 0 || estimatedOutput <= 0) return 0;

    const currentPrice = swapDirection === 'AtoB' ? reserveB / reserveA : reserveA / reserveB;
    const executionPrice = estimatedOutput / inputAmount;
    const impact = ((currentPrice - executionPrice) / currentPrice) * 100;
    return Math.abs(impact);
  }, [amountIn, estimatedOutput, reserveA, reserveB, swapDirection]);

  const handleGenerateProof = useCallback(async () => {
    if (!publicKey) {
      setError('Connect wallet first');
      return;
    }

    if (!isInitialized) {
      setError('ZK system initializing...');
      return;
    }

    try {
      setError(null);
      const userBalance = Math.floor((swapDirection === 'AtoB' ? balanceA : balanceB) * 1000);
      const threshold = 1000;

      if (userBalance < threshold) {
        setError(`Insufficient balance. Need at least ${threshold / 1000} tokens.`);
        return;
      }

      await generateProof({ balance: userBalance, threshold });
      onProofGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proof');
    }
  }, [publicKey, isInitialized, generateProof, onProofGenerated, balanceA, balanceB, swapDirection]);

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
      const minOutLamports = new BN(Math.floor(minOutput * 1e9));

      const userTokenA = await getAssociatedTokenAddress(poolConfig.tokenAMint, publicKey);
      const userTokenB = await getAssociatedTokenAddress(poolConfig.tokenBMint, publicKey);

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

      const { ComputeBudgetProgram } = await import('@solana/web3.js');
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 });
      const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 });

      tx.instructions.unshift(modifyComputeUnits, addPriorityFee);

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      await connection.confirmTransaction(signature, 'confirmed');
      setTxSignature(signature);
      setAmountIn('');
    } catch (err) {
      console.error('Swap error:', err);
      setError(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  }, [publicKey, signTransaction, program, proof, amountIn, minOutput, poolConfig, connection, swapDirection]);

  const fromToken = swapDirection === 'AtoB' ? 'Token A' : 'Token B';
  const toToken = swapDirection === 'AtoB' ? 'Token B' : 'Token A';
  const fromBalance = swapDirection === 'AtoB' ? balanceA : balanceB;
  const toBalance = swapDirection === 'AtoB' ? balanceB : balanceA;

  const setMaxAmount = () => {
    setAmountIn(fromBalance.toString());
  };

  const flipDirection = () => {
    setSwapDirection(prev => prev === 'AtoB' ? 'BtoA' : 'AtoB');
    setAmountIn('');
  };

  if (!poolConfig) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Swap</h2>
        <div className="p-4 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid var(--warning)' }}>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--warning)' }}>⚠️ Pool Not Configured</p>
          <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Configure environment variables to connect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Swap</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg transition-colors"
          style={{ background: showSettings ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
          <p className="text-xs mb-3" style={{ color: 'var(--text-primary)' }}>Slippage Tolerance</p>
          <div className="flex gap-2">
            {[0.1, 0.5, 1.0].map((val) => (
              <button
                key={val}
                onClick={() => setSlippage(val)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: slippage === val ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                  color: slippage === val ? '#0d0d0f' : 'var(--text-primary)'
                }}
              >
                {val}%
              </button>
            ))}
            <div className="flex items-center gap-1 px-2 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                className="w-12 bg-transparent text-sm text-right outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>%</span>
            </div>
          </div>
        </div>
      )}

      {/* ZK System Status */}
      {!isInitialized && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.3)', color: 'var(--accent-primary)' }}>
          Initializing ZK proof system...
        </div>
      )}

      {/* You Pay Section */}
      <div className="rounded-xl p-4 mb-2" style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>You pay</span>
          <button
            onClick={setMaxAmount}
            className="text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--accent-primary)' }}
          >
            Balance: {fromBalance.toFixed(4)} (Max)
          </button>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0"
            className="flex-1 bg-transparent text-2xl font-medium outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <div className="px-4 py-2 rounded-xl font-medium" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)' }}>
            {fromToken}
          </div>
        </div>
      </div>

      {/* Flip Button */}
      <div className="flex justify-center -my-3 relative z-10">
        <button
          onClick={flipDirection}
          className="p-2 rounded-xl border transition-all hover:scale-110"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
        >
          <svg className="w-5 h-5" style={{ color: 'var(--text-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* You Receive Section */}
      <div className="rounded-xl p-4 mt-2" style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>You receive</span>
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Balance: {toBalance.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-2xl font-medium" style={{ color: estimatedOutput > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {estimatedOutput > 0 ? estimatedOutput.toFixed(6) : '0'}
          </div>
          <div className="px-4 py-2 rounded-xl font-medium" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)' }}>
            {toToken}
          </div>
        </div>
      </div>

      {/* Swap Details */}
      {parseFloat(amountIn) > 0 && estimatedOutput > 0 && (
        <div className="mt-4 p-3 rounded-xl text-xs space-y-2" style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-primary)' }}>Rate</span>
            <span style={{ color: 'var(--text-primary)' }}>
              1 {fromToken} = {(estimatedOutput / parseFloat(amountIn)).toFixed(6)} {toToken}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-primary)' }}>Minimum received</span>
            <span style={{ color: 'var(--text-primary)' }}>{minOutput.toFixed(6)} {toToken}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-primary)' }}>Price impact</span>
            <span style={{ color: priceImpact > 5 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-primary)' }}>Slippage tolerance</span>
            <span style={{ color: 'var(--text-primary)' }}>{slippage}%</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6">
        {!proofGenerated ? (
          <button
            onClick={handleGenerateProof}
            disabled={isGenerating || !isInitialized}
            className="w-full py-4 rounded-xl font-semibold text-base transition-all dex-button-primary"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner />
                Generating ZK Proof...
              </span>
            ) : (
              'Generate ZK Proof'
            )}
          </button>
        ) : (
          <button
            onClick={handleSwap}
            disabled={isSwapping || !amountIn || parseFloat(amountIn) <= 0}
            className="w-full py-4 rounded-xl font-semibold text-base transition-all"
            style={{
              background: 'var(--success)',
              color: '#0d0d0f',
              opacity: isSwapping || !amountIn || parseFloat(amountIn) <= 0 ? 0.5 : 1,
              cursor: isSwapping || !amountIn || parseFloat(amountIn) <= 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {isSwapping ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner />
                Swapping...
              </span>
            ) : (
              'Swap'
            )}
          </button>
        )}
      </div>

      {/* Error Display */}
      {(error || proofError) && (
        <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', color: 'var(--error)' }}>
          {error || proofError}
        </div>
      )}

      {/* Success Display */}
      {txSignature && (
        <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
          <p className="text-sm mb-2" style={{ color: 'var(--success)' }}>Swap successful!</p>
          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs break-all"
            style={{ color: 'var(--accent-primary)' }}
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
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
