'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useProgram } from '@/hooks/useProgram';
import { usePoolRequirements } from '@/hooks/usePoolRequirements';
import { BN } from '@coral-xyz/anchor';

interface SwapInterfaceV2Props {
  onSwapComplete?: (txSignature: string) => void;
}

const DEFAULT_SLIPPAGE = 1;

/**
 * SwapInterface V2 - Automatic ZK Proof Enforcement
 * 
 * This component automatically:
 * 1. Checks pool requirements when user enters swap amount
 * 2. Shows eligibility status in real-time
 * 3. Generates required proofs automatically when user clicks swap
 * 4. Executes the swap with the generated proofs
 * 
 * Users don't manually generate proofs - it's all handled seamlessly.
 */

export function SwapInterfaceV2({ onSwapComplete }: SwapInterfaceV2Props) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { program, poolConfig } = useProgram();
  const {
    requirements,
    statuses,
    allMet,
    anyChecking,
    checkAllRequirements,
    generateAllProofs,
    reset: resetRequirements,
  } = usePoolRequirements();

  // Swap state
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

  // Pool reserves
  const [reserveA, setReserveA] = useState<number>(0);
  const [reserveB, setReserveB] = useState<number>(0);

  // Fetch balances and reserves
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

        try {
          if (program && poolConfig.poolPda) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const poolAccount = await (program.account as any).pool.fetch(poolConfig.poolPda);
            setReserveA(Number(poolAccount.tokenAReserve) / 1e9);
            setReserveB(Number(poolAccount.tokenBReserve) / 1e9);
          }
        } catch (e) {
          console.error('Error fetching pool reserves:', e);
        }
      } catch (e) {
        console.error('Error fetching balances:', e);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [publicKey, poolConfig, connection, program]);

  // Check requirements when amount changes
  useEffect(() => {
    const amount = parseFloat(amountIn) || 0;
    if (amount > 0 && publicKey) {
      const debounce = setTimeout(() => {
        checkAllRequirements(amount);
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [amountIn, publicKey, checkAllRequirements]);

  // Calculate expected output
  const expectedOutput = useMemo(() => {
    const input = parseFloat(amountIn) || 0;
    if (input <= 0 || reserveA <= 0 || reserveB <= 0) return 0;

    const [inputReserve, outputReserve] = swapDirection === 'AtoB'
      ? [reserveA, reserveB]
      : [reserveB, reserveA];

    const inputWithFee = input * 997;
    const numerator = inputWithFee * outputReserve;
    const denominator = inputReserve * 1000 + inputWithFee;
    return numerator / denominator;
  }, [amountIn, reserveA, reserveB, swapDirection]);

  const minOutput = expectedOutput * (1 - slippage / 100);

  const priceImpact = useMemo(() => {
    const input = parseFloat(amountIn) || 0;
    if (input <= 0 || reserveA <= 0 || reserveB <= 0) return 0;
    const [inputReserve, outputReserve] = swapDirection === 'AtoB'
      ? [reserveA, reserveB]
      : [reserveB, reserveA];
    const spotPrice = outputReserve / inputReserve;
    const executionPrice = expectedOutput / input;
    return Math.abs((spotPrice - executionPrice) / spotPrice) * 100;
  }, [amountIn, reserveA, reserveB, swapDirection, expectedOutput]);

  // Handle swap - automatically generates proofs and executes
  const handleSwap = useCallback(async () => {
    if (!publicKey || !signTransaction || !program || !poolConfig) {
      setError('Missing requirements for swap');
      return;
    }

    const swapAmount = parseFloat(amountIn);
    if (!swapAmount || swapAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }

    setIsSwapping(true);
    setError(null);

    try {
      // Generate all required proofs automatically
      const primaryProof = await generateAllProofs(swapAmount);

      if (!primaryProof) {
        setError('Failed to generate required proofs. Please try again.');
        setIsSwapping(false);
        return;
      }



      // Step 3: Execute the swap
      const amountInLamports = new BN(Math.floor(swapAmount * 1e9));
      const minOutLamports = new BN(Math.floor(minOutput * 1e9));

      const userTokenA = await getAssociatedTokenAddress(poolConfig.tokenAMint, publicKey);
      const userTokenB = await getAssociatedTokenAddress(poolConfig.tokenBMint, publicKey);

      const methodName = swapDirection === 'AtoB' ? 'zkSwap' : 'zkSwapReverse';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (program.methods as any)[methodName](
        amountInLamports,
        minOutLamports,
        Buffer.from(primaryProof.proof),
        Buffer.from(primaryProof.publicInputs)
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
      onSwapComplete?.(signature);



    } catch (err) {

      let errorMessage = err instanceof Error ? err.message : 'Swap failed';
      if (errorMessage.includes('insufficient funds') || errorMessage.includes('0x1')) {
        errorMessage = 'Insufficient liquidity in pool. Try a smaller amount.';
      } else if (errorMessage.includes('SlippageExceeded') || errorMessage.includes('0x1770')) {
        errorMessage = 'Slippage tolerance exceeded. Try increasing slippage.';
      }
      setError(errorMessage);
    } finally {
      setIsSwapping(false);
    }
  }, [
    publicKey, signTransaction, program, poolConfig, amountIn, minOutput,
    swapDirection, connection, generateAllProofs, onSwapComplete
  ]);

  // Reset handler
  const handleReset = useCallback(() => {
    resetRequirements();
    setAmountIn('');
    setTxSignature(null);
    setError(null);
  }, [resetRequirements]);

  const fromToken = swapDirection === 'AtoB' ? 'Token A' : 'Token B';
  const toToken = swapDirection === 'AtoB' ? 'Token B' : 'Token A';
  const fromBalance = swapDirection === 'AtoB' ? balanceA : balanceB;

  const flipDirection = () => {
    setSwapDirection(prev => prev === 'AtoB' ? 'BtoA' : 'AtoB');
    setAmountIn('');
    resetRequirements();
  };

  if (!poolConfig) {
    return (
      <div className="p-4 rounded-xl animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
        <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading pool...</p>
      </div>
    );
  }

  const canSwap = allMet && parseFloat(amountIn) > 0 && !isSwapping && !anyChecking;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Swap</h2>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(34, 211, 238, 0.1)', color: 'var(--accent-primary)' }}>
            ZK-Verified
          </span>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1.5 rounded-lg transition-all duration-200 hover:bg-white/10"
          style={{ background: showSettings ? 'rgba(255, 255, 255, 0.1)' : 'transparent' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-3 rounded-lg mb-2" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
          <p className="text-[10px] mb-2 font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Slippage</p>
          <div className="flex gap-1.5">
            {[0.5, 1.0, 2.0].map((val) => (
              <button
                key={val}
                onClick={() => setSlippage(val)}
                className="px-2.5 py-1 rounded text-xs font-medium transition-all duration-200"
                style={{
                  background: slippage === val ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                  color: slippage === val ? '#0d0d0f' : 'var(--text-primary)'
                }}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pool Requirements Status */}
      {requirements.length > 0 && parseFloat(amountIn) > 0 && (
        <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Pool Requirements
          </p>
          {statuses.map((status, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {status.checking ? (
                  <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                ) : status.met ? (
                  <span className="text-green-400">✓</span>
                ) : (
                  <span className="text-red-400">✗</span>
                )}
                <span style={{ color: 'var(--text-secondary)' }}>
                  {status.requirement.description}
                </span>
              </div>
              {status.userValue !== undefined && (
                <span style={{ color: status.met ? 'var(--accent-primary)' : 'var(--error)' }}>
                  {typeof status.userValue === 'number'
                    ? status.userValue.toFixed(4)
                    : status.userValue}
                </span>
              )}
            </div>
          ))}
          {allMet && (
            <p className="text-[10px] pt-1" style={{ color: 'var(--accent-primary)' }}>
              ✓ All requirements met - ZK proofs will be generated automatically
            </p>
          )}
        </div>
      )}

      {/* You Pay Section */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>You Pay</span>
          <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>
            Bal: {fromBalance.toFixed(4)}
            <button
              onClick={() => setAmountIn(fromBalance.toString())}
              className="ml-1.5 font-semibold hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent-primary)' }}
            >
              MAX
            </button>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0.0"
            disabled={isSwapping}
            className="flex-1 bg-transparent text-xl font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <div className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-primary)' }}>
            {fromToken}
          </div>
        </div>
        {/* Quick Amount Buttons */}
        <div className="flex gap-1.5 mt-2">
          {[0.1, 0.5, 1, 5].map((val) => (
            <button
              key={val}
              onClick={() => setAmountIn((parseFloat(amountIn || '0') + val).toString())}
              disabled={isSwapping}
              className="flex-1 py-1 rounded text-[10px] font-medium transition-all duration-200 hover:bg-white/10"
              style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}
            >
              +{val}
            </button>
          ))}
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={flipDirection}
          disabled={isSwapping}
          className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 hover:rotate-180"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--accent-primary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* You Receive Section */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>You Receive</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xl font-bold" style={{ color: expectedOutput > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {expectedOutput > 0 ? expectedOutput.toFixed(4) : '0.0'}
          </span>
          <div className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-primary)' }}>
            {toToken}
          </div>
        </div>
      </div>

      {/* Swap Details */}
      {parseFloat(amountIn) > 0 && (
        <div className="p-2.5 rounded-lg space-y-1.5" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'var(--text-muted)' }}>Rate</span>
            <span style={{ color: 'var(--text-primary)' }}>
              1 {fromToken} = {(expectedOutput / (parseFloat(amountIn) || 1)).toFixed(4)} {toToken}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'var(--text-muted)' }}>Impact</span>
            <span style={{ color: priceImpact > 5 ? 'var(--error)' : 'var(--text-primary)' }}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'var(--text-muted)' }}>Min. Out</span>
            <span style={{ color: 'var(--text-primary)' }}>{minOutput.toFixed(4)} {toToken}</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-2.5 rounded-lg text-xs" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
          {error}
        </div>
      )}

      {/* Success Display */}
      {txSignature && (
        <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(34, 211, 238, 0.1)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent-primary)' }}>✓ Swap Complete</p>
          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] underline opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-primary)' }}
          >
            View on Explorer →
          </a>
          <button
            onClick={handleReset}
            className="mt-2 w-full py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-white/10"
            style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
          >
            New Swap
          </button>
        </div>
      )}

      {/* Swap Button */}
      {!txSignature && (
        <button
          onClick={handleSwap}
          disabled={!canSwap || !publicKey}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#0d0d0f' }}
        >
          {!publicKey ? (
            'Connect Wallet'
          ) : anyChecking ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isSwapping ? 'Swapping...' : 'Checking...'}
            </span>
          ) : !allMet && parseFloat(amountIn) > 0 ? (
            'Requirements Not Met'
          ) : (
            'Swap'
          )}
        </button>
      )}

      {/* ZK Info */}
      <div className="pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span>🔐</span>
          <span>ZK proofs are generated automatically to verify eligibility</span>
        </div>
      </div>
    </div>
  );
}
