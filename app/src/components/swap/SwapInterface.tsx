'use client';

import { useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import { usePoolRequirements } from '@/hooks/usePoolRequirements';
import { useTokenBalances } from '@/hooks/swr/useTokenBalances';
import { usePoolData } from '@/hooks/swr/usePoolData';
import { calculateExpectedOutput, calculatePriceImpact, calculateMinOutput } from '@/lib/amm-math';
import {
    DEBOUNCE_MS,
    SLIPPAGE_OPTIONS,
} from '@/lib/constants';
import { SettingsIcon, SwapIcon } from './icons';
import { RequirementsPanel } from './RequirementsPanel';
import { SwapDetails } from './SwapDetails';
import { SuccessPanel } from './SuccessPanel';
import { SwapButton } from './SwapButton';
import { ProofModeSelector } from './ProofModeSelector';
import { useSwapState } from '@/hooks/useSwapState';
import { useSwapExecution } from '@/hooks/useSwapExecution';
import styles from './swap.module.css';

// Types

interface SwapInterfaceProps {
    onSwapComplete?: (txSignature: string) => void;
}

// Component

export function SwapInterface({ onSwapComplete }: SwapInterfaceProps) {
    const { publicKey } = useWallet();
    const { program, poolConfig } = useProgram();

    // 1. Swap State Management
    const { state, actions } = useSwapState();
    const { amountIn, slippage, direction, showSettings, txSignature, error } = state;
    const {
        setAmountIn,
        setSlippage,
        setShowSettings,
        setTxSignature,
        setError,
        flipDirection,
        reset: resetState,
        addAmount
    } = actions;

    // 2. Pool Requirements & ZK Proofs (with proof mode support)
    const {
        proofMode,
        setProofMode,
        proofModeConfig,
        requirements,
        statuses,
        allMet,
        anyChecking,
        checkAllRequirements,
        generateAllProofs,
        reset: resetRequirements,
    } = usePoolRequirements();

    const requiresEligibilityProofs = requirements.length > 0;

    // 3. Execution Logic
    const { isSwapping, executeSwap } = useSwapExecution({
        poolConfig,
        generateAllProofs,
        requiresEligibilityProofs,
        onSwapComplete: (sig) => {
            setTxSignature(sig);
            onSwapComplete?.(sig);
        },
    });

    // 4. Data Fetching
    const { balanceA, balanceB } = useTokenBalances({
        tokenAMint: poolConfig?.tokenAMint,
        tokenBMint: poolConfig?.tokenBMint,
        enabled: !!publicKey && !!poolConfig,
    });

    const { reserveA, reserveB } = usePoolData({
        program,
        poolPda: poolConfig?.poolPda,
        tokenAReserve: poolConfig?.tokenAReserve,
        tokenBReserve: poolConfig?.tokenBReserve,
        enabled: !!poolConfig,
    });

    // 5. Derived Values & Math
    const fromToken = direction === 'AtoB' ? 'Token A' : 'Token B';
    const toToken = direction === 'AtoB' ? 'Token B' : 'Token A';
    const fromBalance = direction === 'AtoB' ? balanceA : balanceB;
    const toBalance = direction === 'AtoB' ? balanceB : balanceA;
    const [reserveIn, reserveOut] = direction === 'AtoB' ? [reserveA, reserveB] : [reserveB, reserveA];
    const inputMint = direction === 'AtoB' ? poolConfig?.tokenAMint : poolConfig?.tokenBMint;

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

    const canSwap = allMet && inputAmount > 0 && !isSwapping && !anyChecking && !txSignature;

    // 6. Effects
    useEffect(() => {
        if (inputAmount > 0 && publicKey) {
            const timeout = setTimeout(() => checkAllRequirements(inputAmount, inputMint), DEBOUNCE_MS);
            return () => clearTimeout(timeout);
        }
    }, [inputAmount, publicKey, checkAllRequirements, proofMode, inputMint]);

    // 7. Handlers wrapped with execution hook
    const handleSwapClick = async () => {
        setError(null);
        await checkAllRequirements(inputAmount, inputMint);
        await executeSwap(
            inputAmount,
            minOutput,
            direction,
            (err) => setError(err),
            (sig) => setTxSignature(sig)
        );
    };

    const handleReset = () => {
        resetState();
        resetRequirements();
    };

    const handleFlip = () => {
        flipDirection();
        resetRequirements();
    };

    const handleProofModeChange = (mode: typeof proofMode) => {
        setProofMode(mode);
        // Re-check requirements with new mode
        if (inputAmount > 0) {
            setTimeout(() => checkAllRequirements(inputAmount, inputMint), 100);
        }
    };

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    if (!poolConfig) {
        return (
            <div
                className="p-4 rounded-xl animate-pulse"
                style={{ background: 'rgba(255, 255, 255, 0.02)' }}
            >
                <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    Loading pool...
                </p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Swap
                    </h2>
                    <span className={styles.zkBadge}>
                        ZK-Verified
                    </span>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`${styles.iconButton} ${showSettings ? styles.iconButtonActive : ''}`}
                    aria-label="Toggle slippage settings"
                    aria-expanded={showSettings}
                >
                    <SettingsIcon />
                </button>
            </div>

            {/* Proof Mode Selector */}
            <div className="mb-3">
                <ProofModeSelector
                    currentMode={proofMode}
                    onModeChange={handleProofModeChange}
                    disabled={isSwapping || !!txSignature}
                />
            </div>

            {/* Slippage Settings */}
            {showSettings && (
                <div className={styles.settingsPanel}>
                    <p className={`${styles.label} mb-2`}>
                        Slippage
                    </p>
                    <div className="flex gap-1.5" role="group" aria-label="Slippage tolerance options">
                        {SLIPPAGE_OPTIONS.map((val) => (
                            <button
                                key={val}
                                onClick={() => setSlippage(val)}
                                className={`${styles.slippageButton} ${slippage === val ? styles.slippageButtonActive : styles.slippageButtonInactive}`}
                                aria-pressed={slippage === val}
                            >
                                {val}%
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Requirements Panel */}
            {requirements.length > 0 && inputAmount > 0 && (
                <RequirementsPanel 
                    statuses={statuses} 
                    allMet={allMet}
                />
            )}

            {/* Input Token Box */}
            <div className={styles.glassPanel}>
                <div className="flex justify-between mb-1.5">
                    <span className={styles.label}>
                        You Pay
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>
                        Bal: {fromBalance.toFixed(4)}
                        <button
                            onClick={() => setAmountIn(fromBalance.toString())}
                            className={styles.maxButton}
                            aria-label="Use maximum balance"
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
                        className={styles.amountInput}
                        aria-label="Amount to swap"
                    />
                    <div className={styles.tokenBadge}>
                        {fromToken}
                    </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                    {[0.5, 1, 2, 5].map((amount) => (
                        <button
                            key={amount}
                            onClick={() => addAmount(amount)}
                            disabled={isSwapping}
                            className={styles.quickAmountButton}
                            aria-label={`Add ${amount} tokens`}
                        >
                            +{amount}
                        </button>
                    ))}
                </div>
            </div>

            {/* Swap Direction Toggle */}
            <div className="flex justify-center -my-1 relative z-10">
                <button
                    onClick={handleFlip}
                    disabled={isSwapping}
                    className={styles.flipButton}
                    aria-label="Switch swap direction"
                >
                    <SwapIcon />
                </button>
            </div>

            {/* Output Token Box */}
            <div className={styles.glassPanel}>
                <div className="flex justify-between mb-1.5">
                    <span className={styles.label}>
                        You Receive
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>
                        Bal: {toBalance.toFixed(4)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className="flex-1 text-xl font-bold"
                        style={{ color: expectedOutput > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}
                        aria-live="polite"
                    >
                        {expectedOutput > 0 ? expectedOutput.toFixed(4) : '0.0'}
                    </span>
                    <div className={styles.tokenBadge}>
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

            {/* Error Display */}
            {error && (
                <div className={styles.errorPanel} role="alert">
                    {error}
                </div>
            )}

            {/* Success Panel */}
            {txSignature && <SuccessPanel signature={txSignature} onReset={handleReset} />}

            {/* Swap Button */}
            {!txSignature && (
                <SwapButton
                    canSwap={canSwap}
                    isSwapping={isSwapping}
                    anyChecking={anyChecking}
                    allMet={allMet}
                    hasAmount={inputAmount > 0}
                    publicKey={publicKey}
                    onClick={handleSwapClick}
                />
            )}

            {/* Footer */}
            <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <div className="flex items-center gap-2">
                        <span>🔐</span>
                        <span>ZK proofs generated automatically</span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)' }}>
                        {proofModeConfig.requirements.length} proof{proofModeConfig.requirements.length > 1 ? 's' : ''} required
                    </span>
                </div>
            </div>
        </div>
    );
}
