'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProgram } from '@/hooks/useProgram';
import { useConnection } from '@solana/wallet-adapter-react';
import { getAccount } from '@solana/spl-token';

interface PoolData {
  tokenAReserve: number;
  tokenBReserve: number;
  k: number;
  totalFeesA: number;
  totalFeesB: number;
}

export function PoolInfo() {
  const { program, poolPda, poolConfig } = useProgram();
  const { connection } = useConnection();
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPoolData = useCallback(async () => {
    if (!program || !poolPda || !poolConfig) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Fetch pool account data from on-chain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pool = await (program.account as any).pool.fetch(poolPda);

      setPoolData({
        tokenAReserve: pool.tokenAReserve.toNumber() / 1e9,
        tokenBReserve: pool.tokenBReserve.toNumber() / 1e9,
        k: Number(pool.k.toString()) / 1e18, // k is u128, convert via string
        totalFeesA: pool.totalFeesA.toNumber() / 1e9,
        totalFeesB: pool.totalFeesB.toNumber() / 1e9,
      });
    } catch (err) {
      console.error('Error fetching pool data:', err);

      // Try to get reserve balances directly if pool account fetch fails
      if (poolConfig) {
        try {
          const reserveA = await getAccount(connection, poolConfig.tokenAReserve);
          const reserveB = await getAccount(connection, poolConfig.tokenBReserve);

          setPoolData({
            tokenAReserve: Number(reserveA.amount) / 1e9,
            tokenBReserve: Number(reserveB.amount) / 1e9,
            k: (Number(reserveA.amount) / 1e9) * (Number(reserveB.amount) / 1e9),
            totalFeesA: 0,
            totalFeesB: 0,
          });
        } catch {
          setError('Pool not found. Have you created it?');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [program, poolPda, poolConfig, connection]);

  useEffect(() => {
    fetchPoolData();
    // Refresh every 15 seconds
    const interval = setInterval(fetchPoolData, 15000);
    return () => clearInterval(interval);
  }, [fetchPoolData]);

  if (!poolConfig) {
    return (
      <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-semibold mb-4">Pool Info</h2>
        <div className="text-yellow-400 text-sm p-4 bg-yellow-900/20 rounded-lg">
          <p className="font-semibold mb-2">⚠️ Not Configured</p>
          <p className="text-gray-400 text-xs">
            Configure environment variables to connect to a pool.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-semibold mb-6">Pool Info</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Pool Info</h2>
        <button
          onClick={fetchPoolData}
          className="text-xs text-gray-400 hover:text-purple-400 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {poolData ? (
        <div className="space-y-4">
          {/* Reserves */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-3">Reserves</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Token A</span>
                <span className="font-mono text-purple-400">
                  {poolData.tokenAReserve.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Token B</span>
                <span className="font-mono text-pink-400">
                  {poolData.tokenBReserve.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-3">Price</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">A per B</span>
                <span className="font-mono">
                  {poolData.tokenBReserve > 0
                    ? (poolData.tokenAReserve / poolData.tokenBReserve).toFixed(4)
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">B per A</span>
                <span className="font-mono">
                  {poolData.tokenAReserve > 0
                    ? (poolData.tokenBReserve / poolData.tokenAReserve).toFixed(4)
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Fees Collected */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-3">Fees Collected</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Token A</span>
                <span className="font-mono text-green-400">
                  {poolData.totalFeesA.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Token B</span>
                <span className="font-mono text-green-400">
                  {poolData.totalFeesB.toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          {/* Pool Addresses */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-3">Pool Addresses</h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-500">Pool PDA:</span>
                <p className="font-mono text-gray-300 truncate">
                  {poolConfig.poolPda.toBase58()}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Program:</span>
                <p className="font-mono text-gray-300 truncate">
                  {poolConfig.programId.toBase58()}
                </p>
              </div>
            </div>
          </div>

          {/* AMM Info */}
          <div className="text-xs text-gray-500 mt-4">
            <p>AMM: Constant Product (x * y = k)</p>
            <p>Fee: 0.3% per swap</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <p>No pool data available</p>
          <p className="text-sm mt-2">Create a pool first</p>
        </div>
      )}
    </div>
  );
}
