'use client';

import { ProblemCard } from './ProblemCard';

export const ProblemSection = () => {
    return (
        <section className="p-4 md:p-6">
            <div className="section-bg-features rounded-3xl py-16 md:py-24 relative overflow-hidden">

                <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                        {/* Cards Left */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 order-2 lg:order-1">
                            <div className="animate-card-enter">
                                <ProblemCard
                                    title="Balance Exposure"
                                    description="Eligibility checks often force you to show full holdings"
                                />
                            </div>
                            <div className="animate-card-enter-delay-1">
                                <ProblemCard
                                    title="Eligibility Exposure"
                                    description="Proving thresholds links your wallet to sensitive data"
                                />
                            </div>
                            <div className="animate-card-enter-delay-2">
                                <ProblemCard
                                    title="Wallet Linkage"
                                    description="Repeated checks can create a visible identity trail"
                                />
                            </div>
                            <div className="animate-card-enter-delay-3">
                                <ProblemCard
                                    title="Compliance Tradeoff"
                                    description="You share data just to prove you should not share data"
                                />
                            </div>
                        </div>

                        {/* Text Right */}
                        <div className="space-y-6 order-1 lg:order-2 animate-page-enter">
                            <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-tight">
                                <span className="text-white/95">The Problem with</span><br />
                                <span className="text-orange-400/90">DeFi Today</span>
                            </h2>
                            <p className="text-white/50 text-lg md:text-xl font-light leading-relaxed max-w-lg">
                                Eligibility gates in DeFi often force data exposure. Your holdings and identity get revealed just to prove you qualify.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
