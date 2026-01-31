/* proof mode configs */

import { PoolRequirement, MinBalanceRequirement, TokenHolderRequirement, ExclusionRequirement } from '@/types/pool';

export type ProofMode = 'shielded' | 'min_balance' | 'token_holder' | 'exclusion' | 'all';

/* empty blacklist root */
export const EMPTY_TREE_ROOT = '0';

export interface ProofModeConfig {
    id: ProofMode;
    name: string;
    description: string;
    shortDescription: string;
    icon: string;
    requirements: PoolRequirement[];
    color: string;
}

/* get token mint addresses from env */
function getTokenMints() {
    return {
        tokenA: process.env.NEXT_PUBLIC_TOKEN_A_MINT || 'BzzNnKq1sJfkeUH7iyi823HDwCBSxYBx4s3epbvpvYqk',
        tokenB: process.env.NEXT_PUBLIC_TOKEN_B_MINT || 'CSxuownDqx9oVqojxAedaSmziKeFPRwFbmaoRCK1hrRc',
    };
}

/* proof mode configurations */
export const PROOF_MODES: Record<ProofMode, ProofModeConfig> = {
    shielded: {
        id: 'shielded',
        name: 'Shielded Swap',
        description: 'Swap using shielded deposits and on-chain proof verification',
        shortDescription: 'Shielded spend',
        icon: '🕶️',
        color: 'slate',
        requirements: [],
    },
    min_balance: {
        id: 'min_balance',
        name: 'Min Balance',
        description: 'Prove you have enough tokens to swap without revealing your actual balance',
        shortDescription: 'Balance ≥ swap amount',
        icon: '💰',
        color: 'cyan',
        requirements: [
            {
                type: 'min_balance',
                enabled: true,
                description: 'Sufficient balance for swap',
                threshold: 0.1,
            } as MinBalanceRequirement,
        ],
    },
    token_holder: {
        id: 'token_holder',
        name: 'Token Holder',
        description: 'Prove you hold a minimum amount of a specific token (e.g., governance token)',
        shortDescription: 'Hold ≥ 1 Token B',
        icon: '🏛️',
        color: 'violet',
        get requirements() {
            const { tokenB } = getTokenMints();
            return [
                {
                    type: 'min_balance',
                    enabled: true,
                    description: 'Sufficient balance for swap',
                    threshold: 0.1,
                } as MinBalanceRequirement,
                {
                    type: 'token_holder',
                    enabled: true,
                    description: 'Hold governance token (Token B)',
                    tokenMint: tokenB,
                    tokenSymbol: 'Token B',
                    minRequired: 1, // Must hold at least 1 Token B
                } as TokenHolderRequirement,
            ];
        },
    },
    exclusion: {
        id: 'exclusion',
        name: 'Not Blacklisted',
        description: 'Prove your address is NOT on a sanctions/blacklist without revealing your address',
        shortDescription: 'Not on blacklist',
        icon: '🛡️',
        color: 'emerald',
        requirements: [
            {
                type: 'min_balance',
                enabled: true,
                description: 'Sufficient balance for swap',
                threshold: 0.1,
            } as MinBalanceRequirement,
            {
                type: 'exclusion',
                enabled: true,
                description: 'Not on sanctions list',
                blacklistRoot: EMPTY_TREE_ROOT, // Pre-computed empty tree root
                blacklistName: 'OFAC SDN List',
            } as ExclusionRequirement,
        ],
    },
    all: {
        id: 'all',
        name: 'All Proofs',
        description: 'Demonstrate all three proof types: balance, token holding, and blacklist exclusion',
        shortDescription: 'All 3 proofs',
        icon: '🔐',
        color: 'amber',
        get requirements() {
            const { tokenB } = getTokenMints();
            return [
                {
                    type: 'token_holder',
                    enabled: true,
                    description: 'Hold governance token (Token B)',
                    tokenMint: tokenB,
                    tokenSymbol: 'Token B',
                    minRequired: 1,
                } as TokenHolderRequirement,
                {
                    type: 'min_balance',
                    enabled: true,
                    description: 'Sufficient balance for swap',
                    threshold: 0.1,
                } as MinBalanceRequirement,
                {
                    type: 'exclusion',
                    enabled: true,
                    description: 'Not on sanctions list',
                    blacklistRoot: EMPTY_TREE_ROOT,
                    blacklistName: 'OFAC SDN List',
                } as ExclusionRequirement,
            ];
        },
    },
};

/**
 * Get proof mode config by ID
 */
export function getProofModeConfig(mode: ProofMode): ProofModeConfig {
    return PROOF_MODES[mode];
}

/**
 * Get all available proof modes
 */
export function getAllProofModes(): ProofModeConfig[] {
    return Object.values(PROOF_MODES);
}

/**
 * Default proof mode
 */
export const DEFAULT_PROOF_MODE: ProofMode = 'shielded';

/**
 * Storage key for persisting proof mode selection
 */
export const PROOF_MODE_STORAGE_KEY = 'shadow_proof_mode';

/**
 * Get saved proof mode from localStorage
 */
export function getSavedProofMode(): ProofMode {
    if (typeof window === 'undefined') return DEFAULT_PROOF_MODE;
    const saved = localStorage.getItem(PROOF_MODE_STORAGE_KEY);
    if (saved && saved in PROOF_MODES) {
        return saved as ProofMode;
    }
    return DEFAULT_PROOF_MODE;
}

/**
 * Save proof mode to localStorage
 */
export function saveProofMode(mode: ProofMode): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PROOF_MODE_STORAGE_KEY, mode);
}
