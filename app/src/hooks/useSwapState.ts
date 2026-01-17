import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { DEFAULT_SLIPPAGE_PERCENT } from '@/lib/constants';
import { SwapDirection } from '@/types/swap';

export interface SwapState {
    amountIn: string;
    slippage: number;
    direction: SwapDirection;
    showSettings: boolean;
    txSignature: string | null;
    error: string | null;
}

export interface SwapActions {
    setAmountIn: Dispatch<SetStateAction<string>>;
    setSlippage: Dispatch<SetStateAction<number>>;
    setDirection: Dispatch<SetStateAction<SwapDirection>>;
    setShowSettings: Dispatch<SetStateAction<boolean>>;
    setTxSignature: Dispatch<SetStateAction<string | null>>;
    setError: Dispatch<SetStateAction<string | null>>;
    flipDirection: () => void;
    reset: () => void;
    addAmount: (amount: number) => void;
}

export function useSwapState() {
    const [amountIn, setAmountIn] = useState('');
    const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE_PERCENT);
    const [direction, setDirection] = useState<SwapDirection>('AtoB');
    const [showSettings, setShowSettings] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const flipDirection = useCallback(() => {
        setDirection((d) => (d === 'AtoB' ? 'BtoA' : 'AtoB'));
        setAmountIn('');
        setTxSignature(null);
        setError(null);
    }, []);

    const reset = useCallback(() => {
        setAmountIn('');
        setTxSignature(null);
        setError(null);
    }, []);

    const addAmount = useCallback((amount: number) => {
        setAmountIn((prev) => {
            const current = parseFloat(prev) || 0;
            return (current + amount).toString();
        });
    }, []);

    return {
        state: {
            amountIn,
            slippage,
            direction,
            showSettings,
            txSignature,
            error,
        },
        actions: {
            setAmountIn,
            setSlippage,
            setDirection,
            setShowSettings,
            setTxSignature,
            setError,
            flipDirection,
            reset,
            addAmount,
        },
    };
}
