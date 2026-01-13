'use client';

import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

// Pool configuration loaded from environment variables
export interface PoolConfig {
    programId: PublicKey;
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    poolPda: PublicKey;
    tokenAReserve: PublicKey;
    tokenBReserve: PublicKey;
    verifierProgramId: PublicKey;
    verifierState: PublicKey;
    network: string;
}

/**
 * Parse a public key from environment, with fallback
 */
function parsePublicKey(envValue: string | undefined, fallback: string): PublicKey {
    try {
        if (envValue && envValue.length > 0) {
            return new PublicKey(envValue);
        }
    } catch (e) {
        console.warn('Invalid public key:', envValue);
    }
    return new PublicKey(fallback);
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
        programId: parsePublicKey(programId, '11111111111111111111111111111111'),
        tokenAMint: parsePublicKey(tokenAMint, '11111111111111111111111111111111'),
        tokenBMint: parsePublicKey(tokenBMint, '11111111111111111111111111111111'),
        poolPda: parsePublicKey(
            process.env.NEXT_PUBLIC_POOL_PDA,
            '11111111111111111111111111111111'
        ),
        tokenAReserve: parsePublicKey(
            process.env.NEXT_PUBLIC_TOKEN_A_RESERVE,
            '11111111111111111111111111111111'
        ),
        tokenBReserve: parsePublicKey(
            process.env.NEXT_PUBLIC_TOKEN_B_RESERVE,
            '11111111111111111111111111111111'
        ),
        verifierProgramId: parsePublicKey(
            process.env.NEXT_PUBLIC_VERIFIER_PROGRAM_ID,
            '11111111111111111111111111111111'
        ),
        verifierState: parsePublicKey(
            process.env.NEXT_PUBLIC_VERIFIER_STATE,
            '11111111111111111111111111111111'
        ),
        network: process.env.NEXT_PUBLIC_NETWORK || 'devnet',
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
