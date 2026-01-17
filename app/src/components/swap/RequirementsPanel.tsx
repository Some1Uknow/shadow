'use client';

import { RequirementStatus as RequirementStatusType } from '@/types/pool';

interface RequirementsPanelProps {
    statuses: RequirementStatusType[];
    allMet: boolean;
}

const typeIcons: Record<string, string> = {
    min_balance: '💰',
    token_holder: '🏛️',
    exclusion: '🛡️',
};

export function RequirementsPanel({ statuses, allMet }: RequirementsPanelProps) {
    const hasError = statuses.some(s => s.error);
    const errorStatus = statuses.find(s => s.error);

    return (
        <div className="p-3 rounded-lg space-y-2 mb-3" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    ZK Requirements
                </p>
                {statuses.length > 1 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                        {statuses.filter(s => s.met).length}/{statuses.length} verified
                    </span>
                )}
            </div>
            {statuses.map((status, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2">
                        {status.checking ? (
                            <div className="w-4 h-4 flex items-center justify-center">
                                <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : status.proofGenerated ? (
                            <span className="text-green-400 w-4 text-center">✓✓</span>
                        ) : status.met ? (
                            <span className="text-green-400 w-4 text-center">✓</span>
                        ) : (
                            <span className="text-red-400 w-4 text-center">✗</span>
                        )}
                        <span className="text-sm">{typeIcons[status.requirement.type] || '📋'}</span>
                        <div>
                            <span style={{ color: 'var(--text-secondary)' }}>{status.requirement.description}</span>
                            {status.proofGenerated && (
                                <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(34, 211, 238, 0.2)', color: 'var(--accent-primary)' }}>
                                    proof ready
                                </span>
                            )}
                        </div>
                    </div>
                    {status.userValue !== undefined && (
                        <span 
                            className="text-[10px] font-mono"
                            style={{ color: status.met ? 'var(--accent-primary)' : 'var(--error)' }}
                        >
                            {typeof status.userValue === 'number' ? status.userValue.toFixed(4) : status.userValue}
                        </span>
                    )}
                </div>
            ))}
            {hasError && errorStatus && (
                <div className="text-[10px] p-2 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
                    {errorStatus.error}
                </div>
            )}
            {allMet && (
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <span className="text-green-400">✓</span>
                    <p className="text-[10px]" style={{ color: 'var(--accent-primary)' }}>
                        All requirements verified — ready to generate proofs
                    </p>
                </div>
            )}
        </div>
    );
}
