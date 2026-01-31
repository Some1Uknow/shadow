'use client';

import { useState, useRef, useEffect } from 'react';
import { ProofMode, PROOF_MODES, getAllProofModes } from '@/lib/proof-modes';

interface ProofModeSelectorProps {
    currentMode: ProofMode;
    onModeChange: (mode: ProofMode) => void;
    disabled?: boolean;
}

export function ProofModeSelector({ currentMode, onModeChange, disabled }: ProofModeSelectorProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [scrollStartX, setScrollStartX] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const modes = getAllProofModes();

    // Sync active index with current mode
    useEffect(() => {
        const index = modes.findIndex(m => m.id === currentMode);
        if (index !== -1) setActiveIndex(index);
    }, [currentMode, modes]);

    // Premium accent colors
    const accentColors: Record<string, { primary: string; glow: string; bg: string; border: string }> = {
        slate: {
            primary: '#94a3b8',
            glow: 'rgba(148, 163, 184, 0.45)',
            bg: 'rgba(148, 163, 184, 0.12)',
            border: 'rgba(148, 163, 184, 0.25)',
        },
        cyan: {
            primary: '#22d3ee',
            glow: 'rgba(34, 211, 238, 0.5)',
            bg: 'rgba(34, 211, 238, 0.12)',
            border: 'rgba(34, 211, 238, 0.3)',
        },
        violet: {
            primary: '#a78bfa',
            glow: 'rgba(167, 139, 250, 0.5)',
            bg: 'rgba(167, 139, 250, 0.12)',
            border: 'rgba(167, 139, 250, 0.3)',
        },
        emerald: {
            primary: '#34d399',
            glow: 'rgba(52, 211, 153, 0.5)',
            bg: 'rgba(52, 211, 153, 0.12)',
            border: 'rgba(52, 211, 153, 0.3)',
        },
        amber: {
            primary: '#fbbf24',
            glow: 'rgba(251, 191, 36, 0.5)',
            bg: 'rgba(251, 191, 36, 0.12)',
            border: 'rgba(251, 191, 36, 0.3)',
        },
    };

    const currentModeData = PROOF_MODES[currentMode];
    const colors = accentColors[currentModeData.color] || accentColors.slate;

    // Smooth scroll to index
    const scrollToIndex = (index: number) => {
        if (scrollRef.current) {
            const cardWidth = 140;
            const gap = 10;
            const targetScroll = index * (cardWidth + gap);
            scrollRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
    };

    // Handle card selection
    const handleCardClick = (mode: ProofMode, index: number) => {
        if (disabled || isDragging) return;
        setActiveIndex(index);
        onModeChange(mode);
        scrollToIndex(index);
    };

    // Drag to scroll handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        setIsDragging(true);
        setDragStartX(e.clientX);
        setScrollStartX(scrollRef.current?.scrollLeft || 0);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || disabled) return;
        e.preventDefault();
        const delta = dragStartX - e.clientX;
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollStartX + delta;
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Navigate with keyboard or buttons
    const navigate = (direction: 'prev' | 'next') => {
        if (disabled) return;
        const newIndex = direction === 'prev'
            ? Math.max(0, activeIndex - 1)
            : Math.min(modes.length - 1, activeIndex + 1);

        if (newIndex !== activeIndex) {
            setActiveIndex(newIndex);
            onModeChange(modes[newIndex].id);
            scrollToIndex(newIndex);
        }
    };

    return (
        <div
            className="relative overflow-hidden rounded-xl"
            style={{
                background: 'rgba(0, 0, 0, 0.20)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${colors.border}`,
                boxShadow: `0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.08)`,
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.3s ease',
            }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* Header with current mode info */}
            <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
            >
                <div className="flex items-center gap-2">
                    <span
                        className="text-lg"
                        style={{ filter: `drop-shadow(0 0 8px ${colors.glow})` }}
                    >
                        {currentModeData.icon}
                    </span>
                    <div>
                        <p
                            className="text-xs font-semibold tracking-wide"
                            style={{ color: colors.primary }}
                        >
                            {currentModeData.name}
                        </p>
                        <p
                            className="text-[10px] mt-0.5"
                            style={{ color: 'rgba(255, 255, 255, 0.45)' }}
                        >
                            {currentModeData.shortDescription}
                        </p>
                    </div>
                </div>

                {/* Navigation dots */}
                <div className="flex items-center gap-1.5">
                    {modes.map((mode, index) => {
                        const dotColors = accentColors[mode.color] || accentColors.slate;
                        const isActive = index === activeIndex;
                        return (
                            <button
                                key={mode.id}
                                onClick={() => handleCardClick(mode.id, index)}
                                disabled={disabled}
                                className="transition-all duration-300 rounded-full"
                                style={{
                                    width: isActive ? '18px' : '6px',
                                    height: '6px',
                                    background: isActive
                                        ? `linear-gradient(90deg, ${dotColors.primary}, ${dotColors.glow})`
                                        : 'rgba(255, 255, 255, 0.2)',
                                    boxShadow: isActive ? `0 0 10px ${dotColors.glow}` : 'none',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                }}
                                title={mode.name}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Carousel container */}
            <div className="relative">
                {/* Left fade gradient - subtle */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none"
                    style={{
                        background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.3) 0%, transparent 100%)',
                        opacity: scrollRef.current?.scrollLeft ? 1 : 0,
                        transition: 'opacity 0.2s ease',
                    }}
                />

                {/* Scrollable carousel */}
                <div
                    ref={scrollRef}
                    className="flex gap-2.5 py-3 px-3 overflow-x-auto cursor-grab"
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                        cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {modes.map((mode, index) => {
                        const cardColors = accentColors[mode.color] || accentColors.slate;
                        const isActive = currentMode === mode.id;

                        return (
                            <button
                                key={mode.id}
                                onClick={() => handleCardClick(mode.id, index)}
                                disabled={disabled}
                                className="flex-shrink-0 relative rounded-lg transition-all duration-300 group"
                                style={{
                                    width: '130px',
                                    height: '72px',
                                    background: isActive
                                        ? `linear-gradient(145deg, ${cardColors.bg} 0%, rgba(0,0,0,0.3) 100%)`
                                        : 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${isActive ? cardColors.border : 'rgba(255, 255, 255, 0.06)'}`,
                                    boxShadow: isActive
                                        ? `0 0 20px ${cardColors.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`
                                        : '0 2px 8px rgba(0,0,0,0.2)',
                                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {/* Active indicator line */}
                                <div
                                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-300"
                                    style={{
                                        width: isActive ? '60%' : '0%',
                                        background: `linear-gradient(90deg, transparent, ${cardColors.primary}, transparent)`,
                                        boxShadow: isActive ? `0 0 8px ${cardColors.primary}` : 'none',
                                    }}
                                />

                                {/* Card content */}
                                <div className="flex flex-col items-center justify-center h-full px-2">
                                    <span
                                        className="text-xl mb-1.5 transition-all duration-300"
                                        style={{
                                            filter: isActive ? `drop-shadow(0 0 8px ${cardColors.glow})` : 'none',
                                            transform: isActive ? 'scale(1.1)' : 'scale(1)',
                                        }}
                                    >
                                        {mode.icon}
                                    </span>
                                    <p
                                        className="text-[11px] font-medium text-center leading-tight transition-colors duration-300"
                                        style={{
                                            color: isActive ? cardColors.primary : 'rgba(255, 255, 255, 0.6)',
                                        }}
                                    >
                                        {mode.name}
                                    </p>
                                </div>

                                {/* Selection checkmark */}
                                {isActive && (
                                    <div
                                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                        style={{
                                            background: cardColors.primary,
                                            boxShadow: `0 0 8px ${cardColors.glow}`,
                                        }}
                                    >
                                        <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}

                                {/* Hover glow effect */}
                                <div
                                    className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                    style={{
                                        background: `radial-gradient(circle at center, ${cardColors.glow} 0%, transparent 70%)`,
                                        opacity: isActive ? 0 : undefined,
                                    }}
                                />
                            </button>
                        );
                    })}
                </div>

                {/* Right fade gradient - subtle */}
                <div
                    className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none"
                    style={{
                        background: 'linear-gradient(270deg, rgba(0, 0, 0, 0.3) 0%, transparent 100%)',
                    }}
                />

                {/* Navigation arrows - show on hover */}
                {isHovering && !disabled && (
                    <>
                        <button
                            onClick={() => navigate('prev')}
                            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center z-20 transition-all duration-200 hover:scale-110"
                            style={{
                                background: 'rgba(0, 0, 0, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                opacity: activeIndex === 0 ? 0.3 : 1,
                                cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
                            }}
                            disabled={activeIndex === 0}
                        >
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => navigate('next')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center z-20 transition-all duration-200 hover:scale-110"
                            style={{
                                background: 'rgba(0, 0, 0, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                opacity: activeIndex === modes.length - 1 ? 0.3 : 1,
                                cursor: activeIndex === modes.length - 1 ? 'not-allowed' : 'pointer',
                            }}
                            disabled={activeIndex === modes.length - 1}
                        >
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {/* Subtle footer with mode count */}
            <div
                className="flex items-center justify-center gap-1.5 py-2"
                style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}
            >
                <span className="text-[10px]" style={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                    {activeIndex + 1} of {modes.length} proof modes
                </span>
                <span className="text-[9px]" style={{ color: colors.primary }}>• ZK Verified</span>
            </div>
        </div>
    );
}
