'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useZKProof } from '@/hooks/useZKProof';
import { useProgram } from '@/hooks/useProgram';
import { BN } from '@coral-xyz/anchor';

interface ProofContextData {
  balance: number;
  threshold: number;
  generatedAt: number;
}

interface SwapInterfaceProps {
  onProofGenerated: (context: ProofContextData) => void;
  onProofReset: () => void;
  proofGenerated: boolean;
}

const DEFAULT_SLIPPAGE = 1;

export function SwapInterface({ onProofGenerated, onProofReset, proofGenerated }: SwapInterfaceProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { generateProof, isGenerating, isInitialized, proof, reset: resetProof } = useZKProof();
  const { program, poolConfig } = useProgram();

  const [amountIn, setAmountIn] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
  const [swapDirection, setSwapDirection] = useState<'AtoB' | 'BtoA'>('AtoB');
  const [isSwapping, setIsSwapping] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapStep, setSwapStep] = useState<'idle' | 'generating_proof' | 'proof_ready' | 'swapping' | 'complete'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [proofAmount, setProofAmount] = useState<string | null>(null);

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

  // Handle proof generation
  const handleGenerateProof = useCallback(async () => {
    if (!publicKey || !isInitialized) return;

    setError(null);
    setSwapStep('generating_proof');

    try {
      const userBalance = swapDirection === 'AtoB' ? balanceA : balanceB;
      const threshold = Math.floor(parseFloat(amountIn) * 1000);

      if (userBalance < parseFloat(amountIn)) {
        setError(`Insufficient balance. You have ${userBalance.toFixed(4)} tokens.`);
        setSwapStep('idle');
        return;
      }

      await generateProof({ balance: Math.floor(userBalance * 1000), threshold });
      setProofAmount(amountIn);
      setSwapStep('proof_ready');
      onProofGenerated({
        balance: userBalance,
        threshold: parseFloat(amountIn),
        generatedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proof');
      setSwapStep('idle');
    }
  }, [publicKey, isInitialized, generateProof, onProofGenerated, balanceA, balanceB, swapDirection, amountIn]);

  // Handle swap execution
  const handleSwap = useCallback(async () => {
    if (!publicKey || !signTransaction || !program || !proof || !poolConfig) {
      setError('Missing requirements for swap');
      return;
    }

    setIsSwapping(true);
    setError(null);
    setSwapStep('swapping');

    try {
      const swapAmount = proofAmount || amountIn;
      const amountInLamports = new BN(Math.floor(parseFloat(swapAmount) * 1e9));
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
      setSwapStep('complete');

    } catch (err) {
      console.error('Swap error:', err);
      let errorMessage = err instanceof Error ? err.message : 'Swap failed';
      if (errorMessage.includes('insufficient funds') || errorMessage.includes('0x1')) {
        errorMessage = `Insufficient liquidity in pool. Try a smaller amount.`;
      } else if (errorMessage.includes('SlippageExceeded') || errorMessage.includes('0x1770')) {
        errorMessage = 'Slippage tolerance exceeded. Try increasing slippage.';
      }
      setError(errorMessage);
    } finally {
      setIsSwapping(false);
    }
  }, [publicKey, signTransaction, program, proof, amountIn, proofAmount, minOutput, poolConfig, connection, swapDirection]);

  // Reset handler
  const handleReset = useCallback(() => {
    resetProof();
    setAmountIn('');
    setProofAmount(null);
    setTxSignature(null);
    setError(null);
    setSwapStep('idle');
    onProofReset();
  }, [resetProof, onProofReset]);

  // Add amount helper
  const addAmount = (value: number) => {
    const current = parseFloat(amountIn) || 0;
    setAmountIn((current + value).toString());
  };

  const fromToken = swapDirection === 'AtoB' ? 'Token A' : 'Token B';
  const toToken = swapDirection === 'AtoB' ? 'Token B' : 'Token A';
  const fromBalance = swapDirection === 'AtoB' ? balanceA : balanceB;

  const flipDirection = () => {
    setSwapDirection(prev => prev === 'AtoB' ? 'BtoA' : 'AtoB');
    setAmountIn('');
  };

  if (!poolConfig) {
    return (
      <div className="p-4 rounded-xl animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
        <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading pool...</p>
      </div>
    );
  }

  const amountMismatch = proofGenerated && proofAmount && amountIn !== proofAmount;

  // Step states for progress indicator
  const getStepState = (stepIndex: number) => {
    const states = {
      0: swapStep === 'generating_proof' ? 'active' : (swapStep !== 'idle' ? 'complete' : 'pending'),
      1: swapStep === 'proof_ready' ? 'active' : (swapStep === 'swapping' || swapStep === 'complete' ? 'complete' : 'pending'),
      2: swapStep === 'swapping' ? 'active' : (swapStep === 'complete' ? 'complete' : 'pending'),
    };
    return states[stepIndex as keyof typeof states];
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Swap</h2>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(34, 211, 238, 0.1)', color: 'var(--accent-primary)' }}>
            ZK
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

      {/* Settings Panel - Animated */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-out ${showSettings ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-3 rounded-lg mb-2" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
          <p className="text-[10px] mb-2 font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Slippage</p>
          <div className="flex gap-1.5">
            {[0.5, 1.0, 2.0].map((val) => (
              <button
                key={val}
                onClick={() => setSlippage(val)}
                className="px-2.5 py-1 rounded text-xs font-medium transition-all duration-200"
                style={{
                  background: slippage === val ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: slippage === val ? '#0d0d0f' : 'var(--text-primary)'
                }}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Steps - Connected Lines */}
      <div className="flex items-center justify-center py-2">
        <div className="flex items-center">
          {['Proof', 'Verify', 'Swap'].map((step, i) => {
            const state = getStepState(i);
            return (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div 
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${state === 'active' ? 'scale-110' : ''}`}
                    style={{
                      background: state === 'complete' ? 'var(--accent-primary)' : state === 'active' ? 'rgba(34, 211, 238, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: state === 'complete' ? '#0d0d0f' : state === 'active' ? 'var(--accent-primary)' : 'var(--text-muted)',
                      boxShadow: state === 'active' ? '0 0 12px rgba(34, 211, 238, 0.4)' : 'none'
                    }}
                  >
                    {state === 'complete' ? '✓' : i + 1}
                  </div>
                  <span className="text-[9px] mt-1 font-medium" style={{ color: state === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{step}</span>
                </div>
                {i < 2 && (
                  <div 
                    className="w-8 h-0.5 mx-1 transition-all duration-500"
                    style={{ 
                      background: getStepState(i) === 'complete' 
                        ? 'linear-gradient(90deg, var(--accent-primary), var(--accent-primary))' 
                        : 'rgba(255, 255, 255, 0.1)'
                    }} 
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* You Pay Section */}
      <div 
        className={`rounded-xl p-3 transition-all duration-300 ${proofGenerated ? 'ring-1 ring-cyan-500/30' : ''}`}
        style={{ background: 'rgba(255, 255, 255, 0.02)' }}
      >
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>You Pay</span>
          <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>
            Bal: {fromBalance.toFixed(2)}
            {!proofGenerated && (
              <button onClick={() => setAmountIn(fromBalance.toString())} className="ml-1.5 font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--accent-primary)' }}>MAX</button>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={amountIn}
            onChange={(e) => !proofGenerated && setAmountIn(e.target.value)}
            placeholder="0.0"
            disabled={proofGenerated}
            className="flex-1 bg-transparent text-xl font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ color: 'var(--text-primary)', opacity: proofGenerated ? 0.6 : 1 }}
          />
          <div className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}>
            {fromToken}
          </div>
        </div>
        
        {/* Quick Amount Buttons */}
        {!proofGenerated && (
          <div className="flex gap-1.5 mt-2 animate-fade-in">
            {[0.1, 0.5, 1, 5].map((val) => (
              <button
                key={val}
                onClick={() => addAmount(val)}
                className="px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-200 hover:bg-white/10"
                style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-primary)' }}
              >
                +{val}
              </button>
            ))}
          </div>
        )}
        
        {proofGenerated && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] animate-fade-in" style={{ color: 'var(--accent-primary)' }}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Locked for verification
          </div>
        )}
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={flipDirection}
          disabled={proofGenerated}
          className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 hover:rotate-180"
          style={{ background: 'var(--bg-secondary)', opacity: proofGenerated ? 0.4 : 1 }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--accent-primary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* You Receive Section */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>You Receive</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xl font-bold" style={{ color: expectedOutput > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {expectedOutput > 0 ? expectedOutput.toFixed(4) : '0.0'}
          </span>
          <div className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}>
            {toToken}
          </div>
        </div>
      </div>

      {/* Swap Details - Animated */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-out ${parseFloat(amountIn) > 0 ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-2.5 rounded-lg space-y-1.5" style={{ background: 'rgba(255, 255, 255, 0.01)' }}>
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'var(--text-muted)' }}>Rate</span>
            <span style={{ color: 'var(--text-primary)' }}>1 {fromToken} = {(expectedOutput / (parseFloat(amountIn) || 1)).toFixed(4)} {toToken}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'var(--text-muted)' }}>Impact</span>
            <span style={{ color: priceImpact > 5 ? 'var(--error)' : 'var(--text-primary)' }}>{priceImpact.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'var(--text-muted)' }}>Min. Out</span>
            <span style={{ color: 'var(--text-primary)' }}>{minOutput.toFixed(4)} {toToken}</span>
          </div>
        </div>
      </div>

      {/* Error Display - Animated */}
      {error && (
        <div className="p-2.5 rounded-lg text-xs animate-shake" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
          {error}
        </div>
      )}

      {/* Amount Mismatch Warning */}
      {amountMismatch && (
        <div className="p-2.5 rounded-lg text-xs animate-fade-in" style={{ background: 'rgba(251, 191, 36, 0.1)', color: 'var(--warning)' }}>
          Amount changed. Reset to generate new proof.
        </div>
      )}

      {/* Action Buttons */}
      {!publicKey ? (
        <div className="p-3 rounded-xl text-center text-xs" style={{ background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)' }}>
          Connect wallet to swap
        </div>
      ) : swapStep === 'complete' ? (
        <div className="space-y-2 animate-fade-in">
          <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(34, 211, 238, 0.1)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent-primary)' }}>✓ Swap Complete</p>
            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] underline opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-primary)' }}
              >
                View on Explorer →
              </a>
            )}
          </div>
          <button
            onClick={handleReset}
            className="w-full py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-white/10"
            style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
          >
            New Swap
          </button>
        </div>
      ) : !proofGenerated ? (
        <button
          onClick={handleGenerateProof}
          disabled={!amountIn || parseFloat(amountIn) <= 0 || isGenerating || !isInitialized}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#0d0d0f' }}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating Proof...
            </span>
          ) : (
            'Generate ZK Proof'
          )}
        </button>
      ) : (
        <div className="space-y-2">
          <button
            onClick={handleSwap}
            disabled={isSwapping || !!amountMismatch}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#0d0d0f' }}
          >
            {isSwapping ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Swapping...
              </span>
            ) : (
              'Confirm Swap'
            )}
          </button>
          <button
            onClick={handleReset}
            disabled={isSwapping}
            className="w-full py-1.5 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-white/10"
            style={{ background: 'transparent', color: 'var(--text-muted)' }}
          >
            Reset
          </button>
        </div>
      )}

      {/* ZK Info - Minimal */}
      <div className="pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span>🔐</span>
          <span>ZK proof verifies eligibility without revealing your balance</span>
        </div>
      </div>
    </div>
  );
}
