import { TransactionSignature } from '@solana/web3.js';

// Swap Interaction Types

export type SwapDirection = 'AtoB' | 'BtoA';

export interface SwapState {
    amountIn: string;
    slippage: number;
    direction: SwapDirection;
    isSwapping: boolean;
    isApproving: boolean;
    txSignature: TransactionSignature | null;
    error: string | null;
}

export interface SwapResult {
    signature: TransactionSignature;
    blockhash: string;
    lastValidBlockHeight: number;
}

// Proof Types

export interface ProofGenerationResult {
    proof: Uint8Array;
    publicInputs: Uint8Array;
}

// UI Types

export interface SwapButtonProps {
    canSwap: boolean;
    isSwapping: boolean;
    anyChecking: boolean;
    allMet: boolean;
    hasAmount: boolean;
    publicKey: { toString(): string } | null;
    onClick: () => void;
}

export interface SwapDetailsProps {
    fromToken: string;
    toToken: string;
    rate: number;
    priceImpact: number;
    minOutput: number;
}

export interface RequirementsPanelProps {
    statuses: Array<{
        checking: boolean;
        met: boolean;
        requirement: { description: string };
        userValue?: number | string;
    }>;
    allMet: boolean;
}
