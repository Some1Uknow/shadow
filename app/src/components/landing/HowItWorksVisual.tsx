'use client';

import { useRef } from 'react';
import { AnimatedBeam } from '@/components/ui/animated-beam';

export function HowItWorksVisual() {
    const containerRef = useRef<HTMLDivElement>(null);
    const div1Ref = useRef<HTMLDivElement>(null);
    const div2Ref = useRef<HTMLDivElement>(null);
    const div3Ref = useRef<HTMLDivElement>(null);
    const div4Ref = useRef<HTMLDivElement>(null);

    return (
        <div
            className="relative flex flex-col w-full max-w-md mx-auto gap-6 py-8"
            ref={containerRef}
        >
            {/* Step 1 */}
            <div className="flex items-center gap-6 w-full">
                <div
                    ref={div1Ref}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 backdrop-blur-md shadow-[0_0_30px_-12px_rgba(34,211,238,0.6)] flex-shrink-0"
                >
                    <span className="text-cyan-400 font-bold text-xl">1</span>
                </div>
                <div className="flex-1">
                    <h3 className="text-white/90 font-semibold mb-1">Connect Wallet</h3>
                    <p className="text-white/50 text-sm">Link your Solana wallet to the app</p>
                </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-6 w-full">
                <div
                    ref={div2Ref}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 backdrop-blur-md shadow-[0_0_30px_-12px_rgba(167,139,250,0.6)] flex-shrink-0"
                >
                    <span className="text-violet-400 font-bold text-xl">2</span>
                </div>
                <div className="flex-1">
                    <h3 className="text-white/90 font-semibold mb-1">Enter Amount</h3>
                    <p className="text-white/50 text-sm">Pick a proof mode and amount</p>
                </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-center gap-6 w-full">
                <div
                    ref={div3Ref}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 backdrop-blur-md shadow-[0_0_30px_-12px_rgba(52,211,153,0.6)] flex-shrink-0"
                >
                    <span className="text-emerald-400 font-bold text-xl">3</span>
                </div>
                <div className="flex-1">
                    <h3 className="text-white/90 font-semibold mb-1">Auto-Generate Proof</h3>
                    <p className="text-white/50 text-sm">Proofs are generated in the background</p>
                </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-center gap-6 w-full">
                <div
                    ref={div4Ref}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 backdrop-blur-md shadow-[0_0_30px_-12px_rgba(34,211,238,0.6)] flex-shrink-0"
                >
                    <span className="text-cyan-400 font-bold text-xl">4</span>
                </div>
                <div className="flex-1">
                    <h3 className="text-white/90 font-semibold mb-1">Swap Executes</h3>
                    <p className="text-white/50 text-sm">Swap settles, eligibility stays private</p>
                </div>
            </div>

            {/* Animated Beams */}
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div1Ref}
                toRef={div2Ref}
                curvature={0}
                pathColor="rgba(255, 255, 255, 0.08)"
                pathWidth={2}
                gradientStartColor="#22d3ee"
                gradientStopColor="#a78bfa"
                startYOffset={32}
                endYOffset={-32}
            />
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div2Ref}
                toRef={div3Ref}
                curvature={0}
                pathColor="rgba(255, 255, 255, 0.08)"
                pathWidth={2}
                gradientStartColor="#a78bfa"
                gradientStopColor="#34d399"
                startYOffset={32}
                endYOffset={-32}
            />
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div3Ref}
                toRef={div4Ref}
                curvature={0}
                pathColor="rgba(255, 255, 255, 0.08)"
                pathWidth={2}
                gradientStartColor="#34d399"
                gradientStopColor="#22d3ee"
                startYOffset={32}
                endYOffset={-32}
            />
        </div>
    );
}
