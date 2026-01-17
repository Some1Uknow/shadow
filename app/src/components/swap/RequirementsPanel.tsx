interface RequirementStatus {
    checking: boolean;
    met: boolean;
    requirement: { description: string };
    userValue?: number | string;
}

interface RequirementsPanelProps {
    statuses: RequirementStatus[];
    allMet: boolean;
}

export function RequirementsPanel({ statuses, allMet }: RequirementsPanelProps) {
    return (
        <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Requirements
            </p>
            {statuses.map((status, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        {status.checking ? (
                            <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        ) : status.met ? (
                            <span className="text-green-400">✓</span>
                        ) : (
                            <span className="text-red-400">✗</span>
                        )}
                        <span style={{ color: 'var(--text-secondary)' }}>{status.requirement.description}</span>
                    </div>
                    {status.userValue !== undefined && (
                        <span style={{ color: status.met ? 'var(--accent-primary)' : 'var(--error)' }}>
                            {typeof status.userValue === 'number' ? status.userValue.toFixed(4) : status.userValue}
                        </span>
                    )}
                </div>
            ))}
            {allMet && (
                <p className="text-[10px] pt-1" style={{ color: 'var(--accent-primary)' }}>
                    ✓ All requirements met
                </p>
            )}
        </div>
    );
}
