'use client';

import { useState, useCallback } from 'react';
import { useProgram } from '@/hooks/useProgram';
import { usePoolData } from '@/hooks/swr/usePoolData';

export function PoolInfo() {
  const { program, poolPda, poolConfig } = useProgram();
  const [showAddresses, setShowAddresses] = useState(false);

  const { data: poolData, error, isLoading, mutate } = usePoolData({
    program,
    poolPda: poolConfig?.poolPda,
    tokenAReserve: poolConfig?.tokenAReserve,
    tokenBReserve: poolConfig?.tokenBReserve,
    enabled: !!poolConfig,
  });

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  // ---------------------------------------------------------------------------
  // Loading/Error States
  // ---------------------------------------------------------------------------
  if (!poolConfig) {
    return (
      <div>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Pool Info
        </h2>
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
          }}
        >
          <p className="text-xs" style={{ color: 'var(--warning)' }}>
            Not configured
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Pool Info
        </h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-xl animate-pulse"
              style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Pool Info
        </h2>
        <div
          className="p-4 rounded-xl"
          style={{ background: 'rgba(248, 113, 113, 0.1)' }}
          role="alert"
        >
          <p className="text-xs" style={{ color: 'var(--error)' }}>
            Failed to load pool data
          </p>
          <button
            onClick={handleRefresh}
            className="text-xs mt-2 underline"
            style={{ color: 'var(--text-primary)' }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------
  const tokenAReserve = poolData?.tokenAReserve ?? 0;
  const tokenBReserve = poolData?.tokenBReserve ?? 0;
  const totalReserves = tokenAReserve + tokenBReserve;
  const tokenAPercent = totalReserves > 0 ? (tokenAReserve / totalReserves) * 100 : 50;
  const tokenBPercent = totalReserves > 0 ? (tokenBReserve / totalReserves) * 100 : 50;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-primary)' }}
        >
          Pool Info
        </h2>
        <button
          onClick={handleRefresh}
          className="text-xs transition-colors"
          style={{ color: 'var(--text-primary)' }}
          aria-label="Refresh pool data"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Token Pair */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full" style={{ background: 'var(--accent-primary)' }} />
            <div
              className="w-6 h-6 rounded-full -ml-3"
              style={{ background: 'var(--accent-secondary)' }}
            />
            <span className="font-medium ml-1" style={{ color: 'var(--text-primary)' }}>
              A / B
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Constant Product AMM
          </p>
        </div>

        {/* Reserves */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <p className="text-xs mb-3" style={{ color: 'var(--text-primary)' }}>
            Reserves
          </p>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: 'var(--text-primary)' }}>Token A</span>
                <span className="font-mono" style={{ color: 'var(--accent-primary)' }}>
                  {tokenAReserve.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    background: 'var(--accent-primary)',
                    width: `${Math.min(100, tokenAPercent)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: 'var(--text-primary)' }}>Token B</span>
                <span className="font-mono" style={{ color: 'var(--accent-secondary)' }}>
                  {tokenBReserve.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    background: 'var(--accent-secondary)',
                    width: `${Math.min(100, tokenBPercent)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Price */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <p className="text-xs mb-3" style={{ color: 'var(--text-primary)' }}>
            Price
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="text-center p-2 rounded-lg"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <p className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
                {tokenBReserve > 0 ? (tokenAReserve / tokenBReserve).toFixed(4) : '—'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                A per B
              </p>
            </div>
            <div
              className="text-center p-2 rounded-lg"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <p className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
                {tokenAReserve > 0 ? (tokenBReserve / tokenAReserve).toFixed(4) : '—'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                B per A
              </p>
            </div>
          </div>
        </div>

        {/* Fees */}
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="flex justify-between items-center">
            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
              Fee Tier
            </p>
            <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>
              0.3%
            </span>
          </div>
          {poolData && (poolData.totalFeesA > 0 || poolData.totalFeesB > 0) && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--text-primary)' }}>
                Collected
              </p>
              <div className="flex gap-4 text-xs">
                <span style={{ color: 'var(--text-primary)' }}>
                  A: <span style={{ color: 'var(--success)' }}>{poolData.totalFeesA.toFixed(4)}</span>
                </span>
                <span style={{ color: 'var(--text-primary)' }}>
                  B: <span style={{ color: 'var(--success)' }}>{poolData.totalFeesB.toFixed(4)}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Addresses Toggle */}
        <button
          onClick={() => setShowAddresses(!showAddresses)}
          className="w-full text-xs py-2 transition-colors"
          style={{ color: 'var(--text-primary)' }}
          aria-expanded={showAddresses}
        >
          {showAddresses ? 'Hide' : 'Show'} addresses
        </button>

        {/* Addresses Panel */}
        {showAddresses && (
          <div
            className="p-4 rounded-xl space-y-2 text-xs"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div>
              <p style={{ color: 'var(--text-primary)' }}>Pool</p>
              <p className="font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                {poolConfig.poolPda.toBase58()}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--text-primary)' }}>Program</p>
              <p className="font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                {poolConfig.programId.toBase58()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
