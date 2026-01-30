import { PublicKey } from '@solana/web3.js';

// Pool Constants

/** Default public key fallback for disabled/unconfigured states */
export const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111');

// Configuration Types

export interface PoolConfig {
    programId: PublicKey;
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    poolPda: PublicKey;
    tokenAReserve: PublicKey;
    tokenBReserve: PublicKey;
    shieldedPoolA: PublicKey;
    shieldedPoolB: PublicKey;
    shieldedVaultA: PublicKey;
    shieldedVaultB: PublicKey;
    shieldedRootHistoryA: PublicKey;
    shieldedRootHistoryB: PublicKey;
    shieldedVerifierProgramId: PublicKey;
    verifierProgramId: PublicKey;
    verifierState: PublicKey;
    network: string;
    rpcEndpoint: string;
}

export interface PoolEnvConfig {
    NEXT_PUBLIC_PROGRAM_ID?: string;
    NEXT_PUBLIC_TOKEN_A_MINT?: string;
    NEXT_PUBLIC_TOKEN_B_MINT?: string;
    NEXT_PUBLIC_POOL_PDA?: string;
    NEXT_PUBLIC_TOKEN_A_RESERVE?: string;
    NEXT_PUBLIC_TOKEN_B_RESERVE?: string;
    NEXT_PUBLIC_SHIELDED_POOL_A?: string;
    NEXT_PUBLIC_SHIELDED_POOL_B?: string;
    NEXT_PUBLIC_SHIELDED_VAULT_A?: string;
    NEXT_PUBLIC_SHIELDED_VAULT_B?: string;
    NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_A?: string;
    NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_B?: string;
    NEXT_PUBLIC_SHIELDED_VERIFIER_PROGRAM_ID?: string;
    NEXT_PUBLIC_VERIFIER_PROGRAM_ID?: string;
    NEXT_PUBLIC_VERIFIER_STATE?: string;
    NEXT_PUBLIC_NETWORK?: string;
    NEXT_PUBLIC_RPC_ENDPOINT?: string;
}

// Data Types

export interface PoolReserves {
    tokenAReserve: number;
    tokenBReserve: number;
    lastUpdated: number;
}

export interface TokenPair {
    tokenA: TokenInfo;
    tokenB: TokenInfo;
}

export interface TokenInfo {
    mint: PublicKey;
    symbol: string;
    decimals: number;
    logoURI?: string;
}

// Requirement Types

export type RequirementType = 'min_balance' | 'token_holder' | 'exclusion';

export interface BaseRequirement {
    type: RequirementType;
    enabled: boolean;
    description: string;
}

export interface MinBalanceRequirement extends BaseRequirement {
    type: 'min_balance';
    threshold: number; // In token units
}

export interface TokenHolderRequirement extends BaseRequirement {
    type: 'token_holder';
    tokenMint: string;
    tokenSymbol: string;
    minRequired: number; // In token units
}

export interface ExclusionRequirement extends BaseRequirement {
    type: 'exclusion';
    blacklistRoot: string;
    blacklistName: string;
}

export type PoolRequirement =
    | MinBalanceRequirement
    | TokenHolderRequirement
    | ExclusionRequirement;

export interface RequirementStatus {
    requirement: PoolRequirement;
    met: boolean;
    checking: boolean;
    error: string | null;
    userValue?: number | string;
    proofGenerated: boolean;
}
