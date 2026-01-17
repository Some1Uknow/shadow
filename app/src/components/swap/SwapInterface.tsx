'use client';

/**
 * SwapInterface - Clean, production-grade swap component
 * 
 * Refactored from 505-line monolith into focused components
 * with extracted utilities for testability.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { useProgram } from '@/hooks/useProgram';
import { usePoolRequirements } from '@/hooks/usePoolRequirements';
import {
    calculateExpectedOutput,
    calculatePriceImpact,
    calculateMinOutput,
} from '@/lib/amm-math';
import {
    COMPUTE_UNITS,
    PRIORITY_FEE_MICROLAMPORTS,
    BALANCE_POLL_INTERVAL_MS,
    DEBOUNCE_MS,
    SLIPPAGE_OPTIONS,
    DEFAULT_SLIPPAGE_PERCENT,
    LAMPORTS_MULTIPLIER,
} from '@/lib/constants';

interface SwapInterfaceProps {
    onSwapComplete?: (txSignature: string) => void;
}

type SwapDirection = 'AtoB' | 'BtoA';

export function SwapInterface({ onSwapComplete }: SwapInterfaceProps) {
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

    // State
    const [amountIn, setAmountIn] = useState('');
    const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE_PERCENT);
    const [direction, setDirection] = useState<SwapDirection>('AtoB');
    const [isSwapping, setIsSwapping] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    // Balances
    const [balanceA, setBalanceA] = useState(0);
    const [balanceB, setBalanceB] = useState(0);
    const [reserveA, setReserveA] = useState(0);
    const [reserveB, setReserveB] = useState(0);

    // Derived values
    const fromToken = direction === 'AtoB' ? 'Token A' : 'Token B';
    const toToken = direction === 'AtoB' ? 'Token B' : 'Token A';
    const fromBalance = direction === 'AtoB' ? balanceA : balanceB;

    const [reserveIn, reserveOut] = direction === 'AtoB'
        ? [reserveA, reserveB]
        : [reserveB, reserveA];

    const inputAmount = parseFloat(amountIn) || 0;

    const expectedOutput = useMemo(
        () => calculateExpectedOutput(inputAmount, reserveIn, reserveOut),
        [inputAmount, reserveIn, reserveOut]
    );

    const priceImpact = useMemo(
        () => calculatePriceImpact(inputAmount, reserveIn, reserveOut, expectedOutput),
        [inputAmount, reserveIn, reserveOut, expectedOutput]
    );

    const minOutput = useMemo(
        () => calculateMinOutput(expectedOutput, slippage),
        [expectedOutput, slippage]
    );

    const canSwap = allMet && inputAmount > 0 && !isSwapping && !anyChecking;

    // Fetch balances and reserves
    useEffect(() => {
        if (!publicKey || !poolConfig) return;

        async function fetchData() {
            try {
                const userAtaA = await getAssociatedTokenAddress(poolConfig!.tokenAMint, publicKey!);
                const userAtaB = await getAssociatedTokenAddress(poolConfig!.tokenBMint, publicKey!);

                try {
                    const accountA = await getAccount(connection, userAtaA);
                    setBalanceA(Number(accountA.amount) / LAMPORTS_MULTIPLIER);
                } catch {
                    setBalanceA(0);
                }

                try {
                    const accountB = await getAccount(connection, userAtaB);
                    setBalanceB(Number(accountB.amount) / LAMPORTS_MULTIPLIER);
                } catch {
                    setBalanceB(0);
                }

                if (program && poolConfig?.poolPda) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const poolAccount = await (program.account as any).pool.fetch(poolConfig.poolPda);
                        setReserveA(Number(poolAccount.tokenAReserve) / LAMPORTS_MULTIPLIER);
                        setReserveB(Number(poolAccount.tokenBReserve) / LAMPORTS_MULTIPLIER);
                    } catch (e) {
                        console.error('Error fetching pool reserves:', e);
                    }
                }
            } catch (e) {
                console.error('Error fetching balances:', e);
            }
        }

        fetchData();
        const interval = setInterval(fetchData, BALANCE_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [publicKey, poolConfig, connection, program]);

    // Check requirements when amount changes
    useEffect(() => {
        if (inputAmount > 0 && publicKey) {
            const timeout = setTimeout(() => {
                checkAllRequirements(inputAmount);
            }, DEBOUNCE_MS);
            return () => clearTimeout(timeout);
        }
    }, [inputAmount, publicKey, checkAllRequirements]);

    // Handle swap
    const handleSwap = useCallback(async () => {
        if (!publicKey || !signTransaction || !program || !poolConfig) {
            setError('Wallet not connected');
            return;
        }

        if (inputAmount <= 0) {
            setError('Enter a valid amount');
            return;
        }

        setIsSwapping(true);
        setError(null);

        try {
            const proof = await generateAllProofs(inputAmount);
            if (!proof) {
                throw new Error('Failed to generate proofs');
            }

            const amountInLamports = new BN(Math.floor(inputAmount * LAMPORTS_MULTIPLIER));
            const minOutLamports = new BN(Math.floor(minOutput * LAMPORTS_MULTIPLIER));

            const userTokenA = await getAssociatedTokenAddress(poolConfig.tokenAMint, publicKey);
            const userTokenB = await getAssociatedTokenAddress(poolConfig.tokenBMint, publicKey);

            const methodName = direction === 'AtoB' ? 'zkSwap' : 'zkSwapReverse';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tx = await (program.methods as any)[methodName](
                amountInLamports,
                minOutLamports,
                Buffer.from(proof.proof),
                Buffer.from(proof.publicInputs)
            )
                .accounts({
                    pool: poolConfig.poolPda,
                    userTokenA,
                    userTokenB,
                    tokenAReserve: poolConfig.tokenAReserve,
                    tokenBReserve: poolConfig.tokenBReserve,
                    user: publicKey,
                    verifierProgram: poolConfig.verifierProgramId,
                    verifierState: poolConfig.verifierState,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .transaction();

            const { ComputeBudgetProgram } = await import('@solana/web3.js');
            tx.instructions.unshift(
                ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICROLAMPORTS })
            );

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
            if (message.includes('insufficient funds') || message.includes('0x1')) {
                message = 'Insufficient liquidity. Try a smaller amount.';
            } else if (message.includes('SlippageExceeded') || message.includes('0x1770')) {
                message = 'Slippage exceeded. Try increasing tolerance.';
            }
            setError(message);
        } finally {
            setIsSwapping(false);
        }
    }, [publicKey, signTransaction, program, poolConfig, inputAmount, minOutput, direction, connection, generateAllProofs, onSwapComplete]);

    const handleReset = useCallback(() => {
        resetRequirements();
        setAmountIn('');
        setTxSignature(null);
        setError(null);
    }, [resetRequirements]);

    const flipDirection = useCallback(() => {
        setDirection(d => d === 'AtoB' ? 'BtoA' : 'AtoB');
        setAmountIn('');
        resetRequirements();
    }, [resetRequirements]);

    if (!poolConfig) {
        return (
            <div className="p-4 rounded-xl animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading pool...</p>
            </div>
        );
    }

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
                    <SettingsIcon />
                </button>
            </div>

            {/* Settings */}
            {showSettings && (
                <div className="p-3 rounded-lg mb-2" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                    <p className="text-[10px] mb-2 font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Slippage</p>
                    <div className="flex gap-1.5">
                        {SLIPPAGE_OPTIONS.map((val) => (
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

            {/* Requirements */}
            {requirements.length > 0 && inputAmount > 0 && (
                <RequirementsPanel statuses={statuses} allMet={allMet} />
            )}

            {/* You Pay */}
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
            </div>

            {/* Flip Direction */}
            <div className="flex justify-center -my-1 relative z-10">
                <button
                    onClick={flipDirection}
                    disabled={isSwapping}
                    className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 hover:rotate-180"
                    style={{ background: 'var(--bg-secondary)' }}
                >
                    <SwapIcon />
                </button>
            </div>

            {/* You Receive */}
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
            {inputAmount > 0 && (
                <SwapDetails
                    fromToken={fromToken}
                    toToken={toToken}
                    rate={expectedOutput / inputAmount}
                    priceImpact={priceImpact}
                    minOutput={minOutput}
                />
            )}

            {/* Error */}
            {error && (
                <div className="p-2.5 rounded-lg text-xs" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
                    {error}
                </div>
            )}

            {/* Success */}
            {txSignature && (
                <SuccessPanel signature={txSignature} onReset={handleReset} />
            )}

            {/* Swap Button */}
            {!txSignature && (
                <SwapButton
                    canSwap={canSwap}
                    isSwapping={isSwapping}
                    anyChecking={anyChecking}
                    allMet={allMet}
                    hasAmount={inputAmount > 0}
                    publicKey={publicKey}
                    onClick={handleSwap}
                />
            )}

            {/* Footer */}
            <div className="pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span>🔐</span>
                    <span>ZK proofs generated automatically</span>
                </div>
            </div>
        </div>
    );
}

// Sub-components

function RequirementsPanel({ statuses, allMet }: { statuses: any[]; allMet: boolean }) {
    return (
        <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Requirements
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
                        <span style={{ color: 'var(--text-secondary)' }}>{status.requirement.description}</span>
                    </div>
                    {status.userValue !== undefined && (
                        <span style={{ color: status.met ? 'var(--accent-primary)' : 'var(--error)' }}>
                            {typeof status.userValue === 'number' ? status.userValue.toFixed(4) : status.userValue}
                        </span>
                    )}
                </div>
            ))}
            {allMet && (
                <p className="text-[10px] pt-1" style={{ color: 'var(--accent-primary)' }}>
                    ✓ All requirements met
                </p>
            )}
        </div>
    );
}

function SwapDetails({ fromToken, toToken, rate, priceImpact, minOutput }: {
    fromToken: string;
    toToken: string;
    rate: number;
    priceImpact: number;
    minOutput: number;
}) {
    return (
        <div className="p-2.5 rounded-lg space-y-1.5" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
            <div className="flex justify-between text-[11px]">
                <span style={{ color: 'var(--text-muted)' }}>Rate</span>
                <span style={{ color: 'var(--text-primary)' }}>
                    1 {fromToken} = {rate.toFixed(4)} {toToken}
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
    );
}

function SuccessPanel({ signature, onReset }: { signature: string; onReset: () => void }) {
    return (
        <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(34, 211, 238, 0.1)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent-primary)' }}>✓ Swap Complete</p>
            <a
                href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] underline opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-primary)' }}
            >
                View on Explorer →
            </a>
            <button
                onClick={onReset}
                className="mt-2 w-full py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-white/10"
                style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
            >
                New Swap
            </button>
        </div>
    );
}

function SwapButton({ canSwap, isSwapping, anyChecking, allMet, hasAmount, publicKey, onClick }: {
    canSwap: boolean;
    isSwapping: boolean;
    anyChecking: boolean;
    allMet: boolean;
    hasAmount: boolean;
    publicKey: any;
    onClick: () => void;
}) {
    let label = 'Swap';
    if (!publicKey) label = 'Connect Wallet';
    else if (isSwapping) label = 'Swapping...';
    else if (anyChecking) label = 'Checking...';
    else if (!allMet && hasAmount) label = 'Requirements Not Met';

    return (
        <button
            onClick={onClick}
            disabled={!canSwap || !publicKey}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#0d0d0f' }}
        >
            {(isSwapping || anyChecking) ? (
                <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    {label}
                </span>
            ) : label}
        </button>
    );
}

// Icons

function SettingsIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function SwapIcon() {
    return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--accent-primary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
    );
}

function Spinner() {
    return (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}

// Re-export for backward compatibility
export { SwapInterface as SwapInterfaceV2 };
