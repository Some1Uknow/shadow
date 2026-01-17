'use client';

/**
 * usePoolData - SWR hook for fetching pool reserves and state
 *
 * Features:
 * - Auto-revalidates every 15 seconds
 * - Falls back to direct account reads if program fetch fails
 * - Deduplicates requests
 * - Returns typed pool data
 */

import useSWR from 'swr';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useMemo } from 'react';
import { Program } from '@coral-xyz/anchor';
import { ZkgateIDL } from '@/types/program';
import {
    fetchPoolData,
    fetchPoolReservesFromAccounts,
    getPoolKey,
    PoolData,
    FetchError,
} from '@/lib/fetchers';

/** Pool data refresh interval (15 seconds) */
const POOL_REFRESH_INTERVAL_MS = 15_000;

export interface UsePoolDataOptions {
    /** Anchor program instance */
    program: Program<ZkgateIDL> | null;
    /** Pool PDA */
    poolPda: PublicKey | undefined;
    /** Token A reserve account (for fallback) */
    tokenAReserve?: PublicKey;
    /** Token B reserve account (for fallback) */
    tokenBReserve?: PublicKey;
    /** Enable/disable fetching */
    enabled?: boolean;
}

export interface UsePoolDataReturn {
    /** Pool data including reserves */
    data: PoolData | undefined;
    /** Token A reserve amount */
    reserveA: number;
    /** Token B reserve amount */
    reserveB: number;
    /** Error if fetch failed */
    error: FetchError | Error | undefined;
    /** True during initial load */
    isLoading: boolean;
    /** True while revalidating */
    isValidating: boolean;
    /** Force refresh */
    mutate: () => Promise<PoolData | undefined>;
}

export function usePoolData(options: UsePoolDataOptions): UsePoolDataReturn {
    const { program, poolPda, tokenAReserve, tokenBReserve, enabled = true } = options;
    const { connection } = useConnection();

    // Generate stable cache key
    const swrKey = useMemo(
        () => (enabled && poolPda ? getPoolKey(poolPda.toBase58()) : null),
        [poolPda, enabled]
    );

    // Fetcher with fallback logic
    const fetcher = useMemo(() => {
        if (!poolPda) return null;

        return async (): Promise<PoolData> => {
            // Try program fetch first
            if (program) {
                try {
                    return await fetchPoolData(program, poolPda);
                } catch (error) {
                    // Only fall back if we have reserve accounts
                    if (!tokenAReserve || !tokenBReserve) {
                        throw error;
                    }
                    // Fall through to fallback
                }
            }

            // Fallback: read from reserve accounts directly
            if (tokenAReserve && tokenBReserve) {
                const reserves = await fetchPoolReservesFromAccounts(
                    connection,
                    tokenAReserve,
                    tokenBReserve
                );
                return {
                    ...reserves,
                    totalFeesA: 0,
                    totalFeesB: 0,
                    tokenAMint: '',
                    tokenBMint: '',
                };
            }

            throw new FetchError('No program or reserve accounts available', 'POOL_NOT_FOUND');
        };
    }, [program, poolPda, tokenAReserve, tokenBReserve, connection]);

    const { data, error, isLoading, isValidating, mutate } = useSWR<
        PoolData,
        FetchError | Error
    >(swrKey, fetcher!, {
        refreshInterval: POOL_REFRESH_INTERVAL_MS,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
        errorRetryCount: 2,
        errorRetryInterval: 3000,
    });

    return {
        data,
        reserveA: data?.tokenAReserve ?? 0,
        reserveB: data?.tokenBReserve ?? 0,
        error,
        isLoading,
        isValidating,
        mutate,
    };
}
