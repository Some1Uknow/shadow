'use client';

/**
 * SWR Provider - Global SWR configuration
 *
 * Configures:
 * - Default error retry strategy
 * - Deduplication settings
 * - Focus revalidation
 */

import { SWRConfig } from 'swr';
import { ReactNode } from 'react';

interface SWRProviderProps {
    children: ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
    return (
        <SWRConfig
            value={{
                // Retry failed requests up to 3 times
                errorRetryCount: 3,

                // Wait 5 seconds between retries
                errorRetryInterval: 5000,

                // Dedupe requests within 2 seconds
                dedupingInterval: 2000,

                // Revalidate on window focus
                revalidateOnFocus: true,

                // Revalidate on network reconnect
                revalidateOnReconnect: true,

                // Don't revalidate on mount if data is fresh
                revalidateIfStale: true,

                // Keep previous data while revalidating
                keepPreviousData: true,

                // Custom error handler (optional logging)
                onError: (error, key) => {
                    // Only log non-expected errors
                    if (
                        error.code !== 'TOKEN_ACCOUNT_NOT_FOUND' &&
                        error.code !== 'POOL_NOT_FOUND'
                    ) {
                        console.error(`SWR Error [${key}]:`, error);
                    }
                },
            }}
        >
            {children}
        </SWRConfig>
    );
}
