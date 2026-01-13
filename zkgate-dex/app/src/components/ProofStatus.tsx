'use client';

interface ProofStatusProps {
  proofGenerated: boolean;
}

export function ProofStatus({ proofGenerated }: ProofStatusProps) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left - Status */}
        <div className="flex items-center gap-6">
          {/* Proof Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${proofGenerated ? 'animate-pulse' : ''}`}
              style={{ background: proofGenerated ? 'var(--success)' : 'var(--text-muted)' }}
            />
            <span className="text-sm" style={{ color: proofGenerated ? 'var(--success)' : 'var(--text-secondary)' }}>
              {proofGenerated ? 'Proof Ready' : 'Awaiting Proof'}
            </span>
          </div>

          {/* Divider */}
          <div className="h-4 w-px" style={{ background: 'var(--border-primary)' }} />

          {/* Circuit Info */}
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Circuit: <span style={{ color: 'var(--accent-secondary)' }}>min_balance</span></span>
            <span>•</span>
            <span>Groth16 / BN254</span>
            <span>•</span>
            <span>Sunspot Verifier</span>
          </div>
        </div>

        {/* Right - Privacy Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
          <svg className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-xs font-medium" style={{ color: 'var(--accent-secondary)' }}>Privacy Preserved</span>
        </div>
      </div>
    </div>
  );
}
