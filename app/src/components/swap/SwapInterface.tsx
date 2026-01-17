'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { useProgram } from '@/hooks/useProgram';
import { usePoolRequirements } from '@/hooks/usePoolRequirements';
import { calculateExpectedOutput, calculatePriceImpact, calculateMinOutput } from '@/lib/amm-math';
import { COMPUTE_UNITS, PRIORITY_FEE_MICROLAMPORTS, BALANCE_POLL_INTERVAL_MS, DEBOUNCE_MS, SLIPPAGE_OPTIONS, DEFAULT_SLIPPAGE_PERCENT, LAMPORTS_MULTIPLIER } from '@/lib/constants';
import { SettingsIcon, SwapIcon } from './icons';
import { RequirementsPanel } from './RequirementsPanel';
import { SwapDetails } from './SwapDetails';
import { SuccessPanel } from './SuccessPanel';
import { SwapButton } from './SwapButton';

interface SwapInterfaceProps {
    onSwapComplete?: (txSignature: string) => void;
}

type SwapDirection = 'AtoB' | 'BtoA';

export function SwapInterface({ onSwapComplete }: SwapInterfaceProps) {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const { program, poolConfig } = useProgram();
    const { requirements, statuses, allMet, anyChecking, checkAllRequirements, generateAllProofs, reset: resetRequirements } = usePoolRequirements();

    const [amountIn, setAmountIn] = useState('');
    const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE_PERCENT);
    const [direction, setDirection] = useState<SwapDirection>('AtoB');
    const [isSwapping, setIsSwapping] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [balanceA, setBalanceA] = useState(0);
    const [balanceB, setBalanceB] = useState(0);
    const [reserveA, setReserveA] = useState(0);
    const [reserveB, setReserveB] = useState(0);

    const fromToken = direction === 'AtoB' ? 'Token A' : 'Token B';
    const toToken = direction === 'AtoB' ? 'Token B' : 'Token A';
    const fromBalance = direction === 'AtoB' ? balanceA : balanceB;
    const toBalance = direction === 'AtoB' ? balanceB : balanceA;
    const [reserveIn, reserveOut] = direction === 'AtoB' ? [reserveA, reserveB] : [reserveB, reserveA];
    const inputAmount = parseFloat(amountIn) || 0;
    const expectedOutput = useMemo(() => calculateExpectedOutput(inputAmount, reserveIn, reserveOut), [inputAmount, reserveIn, reserveOut]);
    const priceImpact = useMemo(() => calculatePriceImpact(inputAmount, reserveIn, reserveOut, expectedOutput), [inputAmount, reserveIn, reserveOut, expectedOutput]);
    const minOutput = useMemo(() => calculateMinOutput(expectedOutput, slippage), [expectedOutput, slippage]);
    const canSwap = allMet && inputAmount > 0 && !isSwapping && !anyChecking;

    useEffect(() => {
        if (!publicKey || !poolConfig) return;
        async function fetchData() {
            try {
                const userAtaA = await getAssociatedTokenAddress(poolConfig!.tokenAMint, publicKey!);
                const userAtaB = await getAssociatedTokenAddress(poolConfig!.tokenBMint, publicKey!);
                try { setBalanceA(Number((await getAccount(connection, userAtaA)).amount) / LAMPORTS_MULTIPLIER); } catch { setBalanceA(0); }
                try { setBalanceB(Number((await getAccount(connection, userAtaB)).amount) / LAMPORTS_MULTIPLIER); } catch { setBalanceB(0); }
                if (program && poolConfig?.poolPda) {
                    try {
                        const poolAccount = await (program.account as any).pool.fetch(poolConfig.poolPda);
                        setReserveA(Number(poolAccount.tokenAReserve) / LAMPORTS_MULTIPLIER);
                        setReserveB(Number(poolAccount.tokenBReserve) / LAMPORTS_MULTIPLIER);
                    } catch { }
                }
            } catch { }
        }
        fetchData();
        const interval = setInterval(fetchData, BALANCE_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [publicKey, poolConfig, connection, program]);

    useEffect(() => {
        if (inputAmount > 0 && publicKey) {
            const timeout = setTimeout(() => checkAllRequirements(inputAmount), DEBOUNCE_MS);
            return () => clearTimeout(timeout);
        }
    }, [inputAmount, publicKey, checkAllRequirements]);

    const handleSwap = useCallback(async () => {
        if (!publicKey || !signTransaction || !program || !poolConfig) { setError('Wallet not connected'); return; }
        if (inputAmount <= 0) { setError('Enter a valid amount'); return; }
        setIsSwapping(true);
        setError(null);
        try {
            const proof = await generateAllProofs(inputAmount);
            if (!proof) throw new Error('Failed to generate proofs');
            const amountInLamports = new BN(Math.floor(inputAmount * LAMPORTS_MULTIPLIER));
            const minOutLamports = new BN(Math.floor(minOutput * LAMPORTS_MULTIPLIER));
            const userTokenA = await getAssociatedTokenAddress(poolConfig.tokenAMint, publicKey);
            const userTokenB = await getAssociatedTokenAddress(poolConfig.tokenBMint, publicKey);
            const methodName = direction === 'AtoB' ? 'zkSwap' : 'zkSwapReverse';
            const tx = await (program.methods as any)[methodName](amountInLamports, minOutLamports, Buffer.from(proof.proof), Buffer.from(proof.publicInputs))
                .accounts({ pool: poolConfig.poolPda, userTokenA, userTokenB, tokenAReserve: poolConfig.tokenAReserve, tokenBReserve: poolConfig.tokenBReserve, user: publicKey, verifierProgram: poolConfig.verifierProgramId, verifierState: poolConfig.verifierState, tokenProgram: TOKEN_PROGRAM_ID })
                .transaction();
            const { ComputeBudgetProgram } = await import('@solana/web3.js');
            tx.instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICROLAMPORTS }));
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = publicKey;
            const signedTx = await signTransaction(tx);
            const signature = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(signature, 'confirmed');
            setTxSignature(signature);
            onSwapComplete?.(signature);
        } catch (err) {
            let message = err instanceof Error ? err.message : 'Swap failed';
            if (message.includes('insufficient funds') || message.includes('0x1')) message = 'Insufficient liquidity. Try a smaller amount.';
            else if (message.includes('SlippageExceeded') || message.includes('0x1770')) message = 'Slippage exceeded. Try increasing tolerance.';
            setError(message);
        } finally { setIsSwapping(false); }
    }, [publicKey, signTransaction, program, poolConfig, inputAmount, minOutput, direction, connection, generateAllProofs, onSwapComplete]);

    const handleReset = useCallback(() => { resetRequirements(); setAmountIn(''); setTxSignature(null); setError(null); }, [resetRequirements]);
    const flipDirection = useCallback(() => { setDirection(d => d === 'AtoB' ? 'BtoA' : 'AtoB'); setAmountIn(''); resetRequirements(); }, [resetRequirements]);

    if (!poolConfig) return <div className="p-4 rounded-xl animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.02)' }}><p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading pool...</p></div>;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Swap</h2>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(34, 211, 238, 0.1)', color: 'var(--accent-primary)' }}>ZK-Verified</span>
                </div>
                <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg transition-all duration-200 hover:bg-white/10" style={{ background: showSettings ? 'rgba(255, 255, 255, 0.1)' : 'transparent' }}><SettingsIcon /></button>
            </div>

            {showSettings && (
                <div className="p-3 rounded-lg mb-2" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                    <p className="text-[10px] mb-2 font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Slippage</p>
                    <div className="flex gap-1.5">
                        {SLIPPAGE_OPTIONS.map((val) => (
                            <button key={val} onClick={() => setSlippage(val)} className="px-2.5 py-1 rounded text-xs font-medium transition-all duration-200" style={{ background: slippage === val ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)', color: slippage === val ? '#0d0d0f' : 'var(--text-primary)' }}>{val}%</button>
                        ))}
                    </div>
                </div>
            )}

            {requirements.length > 0 && inputAmount > 0 && <RequirementsPanel statuses={statuses} allMet={allMet} />}

            <div className="rounded-xl p-3" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
                <div className="flex justify-between mb-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>You Pay</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>Bal: {fromBalance.toFixed(4)}<button onClick={() => setAmountIn(fromBalance.toString())} className="ml-1.5 font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--accent-primary)' }}>MAX</button></span>
                </div>
                <div className="flex items-center gap-2">
                    <input type="number" value={amountIn} onChange={(e) => setAmountIn(e.target.value)} placeholder="0.0" disabled={isSwapping} className="flex-1 bg-transparent text-xl font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={{ color: 'var(--text-primary)' }} />
                    <div className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-primary)' }}>{fromToken}</div>
                </div>
                <div className="flex gap-1.5 mt-2">
                    {[0.5, 1, 2, 5].map((amount) => (
                        <button
                            key={amount}
                            onClick={() => {
                                const current = parseFloat(amountIn) || 0;
                                setAmountIn((current + amount).toString());
                            }}
                            disabled={isSwapping}
                            className="px-2 py-1 rounded text-[10px] font-medium transition-all duration-200 hover:opacity-80"
                            style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-primary)' }}
                        >
                            +{amount}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex justify-center -my-1 relative z-10">
                <button onClick={flipDirection} disabled={isSwapping} className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 hover:rotate-180" style={{ background: 'var(--bg-secondary)' }}><SwapIcon /></button>
            </div>

            <div className="rounded-xl p-3" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
                <div className="flex justify-between mb-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>You Receive</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>Bal: {toBalance.toFixed(4)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex-1 text-xl font-bold" style={{ color: expectedOutput > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{expectedOutput > 0 ? expectedOutput.toFixed(4) : '0.0'}</span>
                    <div className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-primary)' }}>{toToken}</div>
                </div>
            </div>

            {inputAmount > 0 && <SwapDetails fromToken={fromToken} toToken={toToken} rate={expectedOutput / inputAmount} priceImpact={priceImpact} minOutput={minOutput} />}
            {error && <div className="p-2.5 rounded-lg text-xs" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>{error}</div>}
            {txSignature && <SuccessPanel signature={txSignature} onReset={handleReset} />}
            {!txSignature && <SwapButton canSwap={canSwap} isSwapping={isSwapping} anyChecking={anyChecking} allMet={allMet} hasAmount={inputAmount > 0} publicKey={publicKey} onClick={handleSwap} />}

            <div className="pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}><span>🔐</span><span>ZK proofs generated automatically</span></div>
            </div>
        </div>
    );
}
