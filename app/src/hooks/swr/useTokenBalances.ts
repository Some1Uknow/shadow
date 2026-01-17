'use client';

/**
 * useTokenBalances - SWR hook for fetching user token balances
 *
 * Features:
 * - Auto-revalidates on window focus
 * - Polls every 30 seconds
 * - Deduplicates concurrent requests
 * - Returns typed balance data
 */

import useSWR from 'swr';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useMemo } from 'react';
import {
    fetchTokenBalances,
    getBalancesKey,
    TokenBalancesResult,
    FetchError,
} from '@/lib/fetchers';
import { BALANCE_POLL_INTERVAL_MS } from '@/lib/constants';

export interface UseTokenBalancesOptions {
    /** Token A mint address */
    tokenAMint: PublicKey | undefined;
    /** Token B mint address */
    tokenBMint: PublicKey | undefined;
    /** Enable/disable polling (default: true) */
    refreshInterval?: number;
    /** Pause fetching when false */
    enabled?: boolean;
}

export interface UseTokenBalancesReturn {
    /** Token A balance in UI units */
    balanceA: number;
    /** Token B balance in UI units */
    balanceB: number;
    /** Full balance data with raw amounts */
    data: TokenBalancesResult | undefined;
    /** Error if fetch failed */
    error: FetchError | Error | undefined;
    /** True while fetching */
    isLoading: boolean;
    /** True after initial fetch */
    isValidating: boolean;
    /** Force refresh balances */
    mutate: () => Promise<TokenBalancesResult | undefined>;
}

export function useTokenBalances(
    options: UseTokenBalancesOptions
): UseTokenBalancesReturn {
    const { tokenAMint, tokenBMint, refreshInterval, enabled = true } = options;
    const { publicKey } = useWallet();
    const { connection } = useConnection();

    // Generate stable cache key
    const swrKey = useMemo(
        () =>
            enabled
                ? getBalancesKey(
                    publicKey?.toBase58(),
                    tokenAMint?.toBase58(),
                    tokenBMint?.toBase58()
                )
                : null,
        [publicKey, tokenAMint, tokenBMint, enabled]
    );

    // SWR fetcher - connection is accessed via closure
    const fetcher = useMemo(() => {
        if (!publicKey || !tokenAMint || !tokenBMint) return null;

        return async (): Promise<TokenBalancesResult> => {
            return fetchTokenBalances(connection, publicKey, tokenAMint, tokenBMint);
        };
    }, [connection, publicKey, tokenAMint, tokenBMint]);

    const { data, error, isLoading, isValidating, mutate } = useSWR<
        TokenBalancesResult,
        FetchError | Error
    >(swrKey, fetcher!, {
        refreshInterval: refreshInterval ?? BALANCE_POLL_INTERVAL_MS,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
    });

    return {
        balanceA: data?.tokenA.balance ?? 0,
        balanceB: data?.tokenB.balance ?? 0,
        data,
        error,
        isLoading,
        isValidating,
        mutate,
    };
}
