
import { useState, useCallback } from 'react';

interface UseFaucetReturn {
    requestTokens: (recipient: string, amountA: number, amountB: number) => Promise<string>;
    isLoading: boolean;
    error: string | null;
}

export function useFaucet(): UseFaucetReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestTokens = useCallback(async (recipient: string, amountA: number, amountB: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/faucet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ recipient, amountA, amountB }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Faucet request failed');
            }

            return data.signature;
        } catch (err: any) {
            const msg = err.message || 'Failed to request tokens';
            setError(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { requestTokens, isLoading, error };
}
