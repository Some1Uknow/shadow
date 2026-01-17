'use client';

import { useState } from 'react';
import { ProofMode, PROOF_MODES, getAllProofModes } from '@/lib/proof-modes';

interface ProofModeSelectorProps {
    currentMode: ProofMode;
    onModeChange: (mode: ProofMode) => void;
    disabled?: boolean;
}

export function ProofModeSelector({ currentMode, onModeChange, disabled }: ProofModeSelectorProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const modes = getAllProofModes();
    const current = PROOF_MODES[currentMode];

    const colorMap: Record<string, string> = {
        cyan: 'rgba(34, 211, 238, 0.15)',
        violet: 'rgba(167, 139, 250, 0.15)',
        emerald: 'rgba(52, 211, 153, 0.15)',
        amber: 'rgba(251, 191, 36, 0.15)',
    };

    const textColorMap: Record<string, string> = {
        cyan: 'rgb(34, 211, 238)',
        violet: 'rgb(167, 139, 250)',
        emerald: 'rgb(52, 211, 153)',
        amber: 'rgb(251, 191, 36)',
    };

    return (
        <div className="relative">
            {/* Current Mode Button */}
            <button
                onClick={() => !disabled && setIsExpanded(!isExpanded)}
                disabled={disabled}
                className="w-full p-3 rounded-lg flex items-center justify-between transition-all"
                style={{
                    background: colorMap[current.color],
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg">{current.icon}</span>
                    <div className="text-left">
                        <p className="text-xs font-medium" style={{ color: textColorMap[current.color] }}>
                            {current.name} Mode
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {current.shortDescription}
                        </p>
                    </div>
                </div>
                <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    style={{ color: textColorMap[current.color] }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown */}
            {isExpanded && !disabled && (
                <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50 border"
                    style={{
                        background: 'rgba(0, 0, 0, 0.95)',
                        borderColor: 'var(--border-primary)',
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    <div className="p-2">
                        <p className="text-[10px] uppercase tracking-wider px-2 py-1" style={{ color: 'var(--text-muted)' }}>
                            Select Proof Mode
                        </p>
                    </div>
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => {
                                onModeChange(mode.id);
                                setIsExpanded(false);
                            }}
                            className="w-full p-3 flex items-start gap-3 hover:bg-white/5 transition-colors text-left"
                            style={{
                                background: currentMode === mode.id ? colorMap[mode.color] : 'transparent',
                            }}
                        >
                            <span className="text-lg mt-0.5">{mode.icon}</span>
                            <div className="flex-1">
                                <p className="text-sm font-medium" style={{ color: textColorMap[mode.color] }}>
                                    {mode.name}
                                </p>
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {mode.description}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {mode.requirements.map((req, i) => (
                                        <span
                                            key={i}
                                            className="text-[9px] px-1.5 py-0.5 rounded"
                                            style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}
                                        >
                                            {req.type.replace('_', ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {currentMode === mode.id && (
                                <span className="text-green-400 text-sm">✓</span>
                            )}
                        </button>
                    ))}
                    <div className="p-2 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                        <p className="text-[9px] px-2" style={{ color: 'var(--text-muted)' }}>
                            💡 Try different modes to see how each ZK proof type works
                        </p>
                    </div>
                </div>
            )}

            {/* Click outside to close */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsExpanded(false)}
                />
            )}
        </div>
    );
}
