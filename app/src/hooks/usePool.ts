'use client';

import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PoolConfig, DEFAULT_PUBKEY } from '@/types/pool';

/**
 * Parse a public key from environment, with fallback
 */
function parsePublicKey(envValue: string | undefined, fallback: PublicKey): PublicKey {
    try {
        if (envValue && envValue.length > 0) {
            return new PublicKey(envValue);
        }
    } catch (e) {
        console.warn('Invalid public key:', envValue);
    }
    return fallback;
}

/**
 * Get pool configuration from environment variables
 */
export function getPoolConfig(): PoolConfig | null {
    // Check if required env vars are set
    const programId = process.env.NEXT_PUBLIC_PROGRAM_ID;
    const tokenAMint = process.env.NEXT_PUBLIC_TOKEN_A_MINT;
    const tokenBMint = process.env.NEXT_PUBLIC_TOKEN_B_MINT;

    if (!programId || !tokenAMint || !tokenBMint) {
        console.warn('Pool config incomplete. Set the following env vars:');
        console.warn('  NEXT_PUBLIC_PROGRAM_ID, NEXT_PUBLIC_TOKEN_A_MINT, NEXT_PUBLIC_TOKEN_B_MINT');
        console.warn('  NEXT_PUBLIC_POOL_PDA, NEXT_PUBLIC_TOKEN_A_RESERVE, NEXT_PUBLIC_TOKEN_B_RESERVE');
        console.warn('  NEXT_PUBLIC_VERIFIER_PROGRAM_ID, NEXT_PUBLIC_VERIFIER_STATE');
        return null;
    }

    return {
        programId: parsePublicKey(programId, DEFAULT_PUBKEY),
        tokenAMint: parsePublicKey(tokenAMint, DEFAULT_PUBKEY),
        tokenBMint: parsePublicKey(tokenBMint, DEFAULT_PUBKEY),
        poolPda: parsePublicKey(process.env.NEXT_PUBLIC_POOL_PDA, DEFAULT_PUBKEY),
        tokenAReserve: parsePublicKey(process.env.NEXT_PUBLIC_TOKEN_A_RESERVE, DEFAULT_PUBKEY),
        tokenBReserve: parsePublicKey(process.env.NEXT_PUBLIC_TOKEN_B_RESERVE, DEFAULT_PUBKEY),
        shieldedPoolA: parsePublicKey(process.env.NEXT_PUBLIC_SHIELDED_POOL_A, DEFAULT_PUBKEY),
        shieldedPoolB: parsePublicKey(process.env.NEXT_PUBLIC_SHIELDED_POOL_B, DEFAULT_PUBKEY),
        shieldedVaultA: parsePublicKey(process.env.NEXT_PUBLIC_SHIELDED_VAULT_A, DEFAULT_PUBKEY),
        shieldedVaultB: parsePublicKey(process.env.NEXT_PUBLIC_SHIELDED_VAULT_B, DEFAULT_PUBKEY),
        shieldedRootHistoryA: parsePublicKey(process.env.NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_A, DEFAULT_PUBKEY),
        shieldedRootHistoryB: parsePublicKey(process.env.NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_B, DEFAULT_PUBKEY),
        shieldedVerifierProgramId: parsePublicKey(process.env.NEXT_PUBLIC_SHIELDED_VERIFIER_PROGRAM_ID, DEFAULT_PUBKEY),
        verifierProgramId: parsePublicKey(process.env.NEXT_PUBLIC_VERIFIER_PROGRAM_ID, DEFAULT_PUBKEY),
        verifierState: parsePublicKey(process.env.NEXT_PUBLIC_VERIFIER_STATE, DEFAULT_PUBKEY),
        network: process.env.NEXT_PUBLIC_NETWORK || 'devnet',
        rpcEndpoint: process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com',
    };
}

/**
 * Hook to access pool configuration and compute user token accounts
 */
export function usePool() {
    const { publicKey } = useWallet();
    const { connection } = useConnection();

    const config = useMemo(() => getPoolConfig(), []);

    // Compute user's Associated Token Accounts
    const userTokenAccounts = useMemo(() => {
        if (!publicKey || !config) return null;

        return {
            // These will be computed asynchronously
            userTokenA: null as PublicKey | null,
            userTokenB: null as PublicKey | null,
        };
    }, [publicKey, config]);

    return {
        config,
        isConfigured: config !== null,
        userTokenAccounts,
        connection,
    };
}

/**
 * Get user's ATA for a given mint
 */
export async function getUserATA(
    owner: PublicKey,
    mint: PublicKey
): Promise<PublicKey> {
    return getAssociatedTokenAddress(mint, owner);
}

/**
 * Compute the pool PDA from token mints
 */
export function computePoolPda(
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    programId: PublicKey
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('pool'), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
        programId
    );
}
