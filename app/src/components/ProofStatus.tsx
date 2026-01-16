'use client';

import { useMemo } from 'react';
import { CircuitType, CIRCUIT_INFO, ProofContext } from '@/hooks/useZKProof';

// Legacy interface for backwards compatibility
interface LegacyProofContext {
  balance: number;
  threshold: number;
  generatedAt: number;
}

interface ProofStatusProps {
  proofGenerated: boolean;
  proofContext?: LegacyProofContext | ProofContext | null;
  circuit?: CircuitType;
}

// Type guard to check if context is the new ProofContext type
function isNewProofContext(context: LegacyProofContext | ProofContext): context is ProofContext {
  return 'circuit' in context;
}

export function ProofStatus({ proofGenerated, proofContext, circuit }: ProofStatusProps) {
  // Determine the circuit type
  const circuitType: CircuitType = useMemo(() => {
    if (circuit) return circuit;
    if (proofContext && isNewProofContext(proofContext)) return proofContext.circuit;
    return 'min_balance';
  }, [circuit, proofContext]);

  // Calculate time since proof was generated
  const proofAge = useMemo(() => {
    if (!proofContext) return null;
    const generatedAt = isNewProofContext(proofContext) 
      ? proofContext.generatedAt 
      : proofContext.generatedAt;
    if (!generatedAt) return null;
    
    const seconds = Math.floor((Date.now() - generatedAt) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }, [proofContext]);

  // Get proof description based on circuit type
  const proofDescription = useMemo(() => {
    if (!proofContext) return null;

    if (isNewProofContext(proofContext)) {
      // New multi-circuit context
      if (proofContext.minBalance) {
        return `balance ≥ ${proofContext.minBalance.threshold.toFixed(2)} SOL`;
      }
      if (proofContext.tokenHolder) {
        const minReq = parseInt(proofContext.tokenHolder.min_required) / 1e9;
        return `holdings ≥ ${minReq.toFixed(2)} tokens`;
      }
      if (proofContext.exclusion) {
        return 'address NOT on blacklist';
      }
    } else {
      // Legacy context
      return `balance ≥ ${(proofContext.threshold / 1000).toFixed(1)} tokens`;
    }

    return null;
  }, [proofContext]);

  const circuitInfo = CIRCUIT_INFO[circuitType];

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left - Status */}
        <div className="flex items-center gap-4 md:gap-6 flex-wrap">
          {/* Proof Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${proofGenerated ? 'animate-pulse' : ''}`}
              style={{ background: proofGenerated ? 'var(--success)' : 'var(--text-muted)' }}
            />
            <span className="text-sm" style={{ color: proofGenerated ? 'var(--success)' : 'var(--text-secondary)' }}>
              {proofGenerated ? 'Proof Ready' : 'Awaiting Proof'}
            </span>
            {proofGenerated && proofAge && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ({proofAge})
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="hidden md:block h-4 w-px" style={{ background: 'var(--border-primary)' }} />

          {/* Circuit Info */}
          <div className="flex items-center gap-2 md:gap-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
            <span>
              Circuit: <span style={{ color: 'var(--accent-secondary)' }}>{circuitInfo.name}</span>
            </span>
            <span className="hidden md:inline">•</span>
            <span>Groth16 / BN254</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">Sunspot Verifier</span>
          </div>

          {/* Proof Context (when available) */}
          {proofGenerated && proofDescription && (
            <>
              <div className="hidden md:block h-4 w-px" style={{ background: 'var(--border-primary)' }} />
              <div className="flex items-center gap-2 text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Proved:</span>
                <span style={{ color: 'var(--accent-primary)' }}>
                  {proofDescription}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right - Privacy Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
          <svg className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs font-medium" style={{ color: 'var(--accent-secondary)' }}>Privacy Preserved</span>
        </div>
      </div>

      {/* Circuit-specific info bar */}
      {proofGenerated && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>🔐</span>
            <span>{circuitInfo.description}</span>
          </div>
        </div>
      )}
    </div>
  );
}
