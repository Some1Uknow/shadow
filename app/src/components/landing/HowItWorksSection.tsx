'use client';

import { HowItWorksVisual } from './HowItWorksVisual';

export const HowItWorksSection = () => {
    return (
        <section className="p-4 md:p-6">
            <div className="section-bg-howitworks rounded-3xl py-16 md:py-24 relative overflow-hidden">

                <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                        {/* Text Left */}
                        <div className="space-y-6">
                            <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-tight">
                                <span className="text-white/95">How It</span><br />
                                <span className="text-emerald-400/90">Works</span>
                            </h2>
                            <p className="text-white/50 text-lg md:text-xl font-light leading-relaxed max-w-lg">
                                A simple flow from wallet connection to proof and swap. No manual proof steps. Everything runs automatically.
                            </p>
                        </div>

                        {/* Visual Steps Right */}
                        <div className="relative">
                            <HowItWorksVisual />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
