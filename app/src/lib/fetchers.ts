/**
 * SWR Fetcher Functions
 * Type-safe data fetching utilities with error handling
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, Account } from '@solana/spl-token';
import { Program } from '@coral-xyz/anchor';
import { ZkgateIDL } from '@/types/program';
import { LAMPORTS_MULTIPLIER } from './constants';

// Error Types

export class FetchError extends Error {
    constructor(
        message: string,
        public readonly code: FetchErrorCode,
        public readonly cause?: unknown
    ) {
        super(message);
        this.name = 'FetchError';
    }
}

export type FetchErrorCode =
    | 'TOKEN_ACCOUNT_NOT_FOUND'
    | 'POOL_NOT_FOUND'
    | 'CONNECTION_ERROR'
    | 'INVALID_DATA';

// Token Balance Fetcher

export interface TokenBalance {
    mint: string;
    balance: number;
    rawAmount: bigint;
}

export interface TokenBalancesResult {
    tokenA: TokenBalance;
    tokenB: TokenBalance;
}

/**
 * Fetch user's token balances for both pool tokens
 */

export async function fetchTokenBalances(
    connection: Connection,
    walletPubkey: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey
): Promise<TokenBalancesResult> {
    const [ataA, ataB] = await Promise.all([
        getAssociatedTokenAddress(tokenAMint, walletPubkey),
        getAssociatedTokenAddress(tokenBMint, walletPubkey),
    ]);

    const [balanceA, balanceB] = await Promise.all([
        fetchSingleTokenBalance(connection, ataA, tokenAMint.toBase58()),
        fetchSingleTokenBalance(connection, ataB, tokenBMint.toBase58()),
    ]);

    return {
        tokenA: balanceA,
        tokenB: balanceB,
    };
}

async function fetchSingleTokenBalance(
    connection: Connection,
    ataAddress: PublicKey,
    mintAddress: string
): Promise<TokenBalance> {
    try {
        const account: Account = await getAccount(connection, ataAddress);
        return {
            mint: mintAddress,
            balance: Number(account.amount) / LAMPORTS_MULTIPLIER,
            rawAmount: account.amount,
        };
    } catch (error) {
        // Account doesn't exist = 0 balance (not an error for our use case)
        if (isTokenAccountNotFoundError(error)) {
            return {
                mint: mintAddress,
                balance: 0,
                rawAmount: BigInt(0),
            };
        }
        throw new FetchError(
            'Failed to fetch token balance',
            'CONNECTION_ERROR',
            error
        );
    }
}

function isTokenAccountNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
        return (
            error.message.includes('could not find account') ||
            error.message.includes('Account does not exist') ||
            error.name === 'TokenAccountNotFoundError'
        );
    }
    return false;
}

// Pool Data Fetcher

export interface PoolData {
    tokenAReserve: number;
    tokenBReserve: number;
    k: number;
    totalFeesA: number;
    totalFeesB: number;
    tokenAMint: string;
    tokenBMint: string;
}

/** K value divisor (u128 precision) */
const K_DIVISOR = 1e18;

/**
 * Fetch pool reserve data
 */

export async function fetchPoolData(
    program: Program<ZkgateIDL>,
    poolPda: PublicKey
): Promise<PoolData> {
    try {
        // @ts-ignore - mismatch between IDL type (Pool) and runtime (pool)
        const pool = await program.account.pool.fetch(poolPda);

        return {
            tokenAReserve: Number(pool.tokenAReserve) / LAMPORTS_MULTIPLIER,
            tokenBReserve: Number(pool.tokenBReserve) / LAMPORTS_MULTIPLIER,
            k: Number(pool.k.toString()) / K_DIVISOR,
            totalFeesA: Number(pool.totalFeesA) / LAMPORTS_MULTIPLIER,
            totalFeesB: Number(pool.totalFeesB) / LAMPORTS_MULTIPLIER,
            tokenAMint: pool.tokenAMint.toBase58(),
            tokenBMint: pool.tokenBMint.toBase58(),
        };
    } catch (error) {
        throw new FetchError('Failed to fetch pool data', 'POOL_NOT_FOUND', error);
    }
}

/**
 * Fallback: fetch pool reserves from token accounts directly
 */
export async function fetchPoolReservesFromAccounts(
    connection: Connection,
    tokenAReserveAddress: PublicKey,
    tokenBReserveAddress: PublicKey
): Promise<Pick<PoolData, 'tokenAReserve' | 'tokenBReserve' | 'k'>> {
    try {
        const [reserveA, reserveB] = await Promise.all([
            getAccount(connection, tokenAReserveAddress),
            getAccount(connection, tokenBReserveAddress),
        ]);

        const tokenAReserve = Number(reserveA.amount) / LAMPORTS_MULTIPLIER;
        const tokenBReserve = Number(reserveB.amount) / LAMPORTS_MULTIPLIER;

        return {
            tokenAReserve,
            tokenBReserve,
            k: tokenAReserve * tokenBReserve,
        };
    } catch (error) {
        throw new FetchError(
            'Failed to fetch reserve accounts',
            'POOL_NOT_FOUND',
            error
        );
    }
}

// SWR Key Builders

/**
 * Generate a stable cache key for token balances
 */
export function getBalancesKey(
    walletAddress: string | null | undefined,
    tokenAMint: string | undefined,
    tokenBMint: string | undefined
): string | null {
    if (!walletAddress || !tokenAMint || !tokenBMint) return null;
    return `balances-${walletAddress}-${tokenAMint}-${tokenBMint}`;
}

/**
 * Generate a stable cache key for pool data
 */
export function getPoolKey(poolPda: string | null | undefined): string | null {
    if (!poolPda) return null;
    return `pool-${poolPda}`;
}
