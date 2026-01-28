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
                                    description="Anyone can see exactly how much you hold in your wallet"
                                />
                            </div>
                            <div className="animate-card-enter-delay-1">
                                <ProblemCard
                                    title="Front-Running"
                                    description="Bots see your pending trades and jump ahead for profit"
                                />
                            </div>
                            <div className="animate-card-enter-delay-2">
                                <ProblemCard
                                    title="Whale Tracking"
                                    description="Large holders become targets for scams and social engineering"
                                />
                            </div>
                            <div className="animate-card-enter-delay-3">
                                <ProblemCard
                                    title="KYC Paradox"
                                    description="Proving eligibility requires exposing the data you want private"
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
                                Every time you interact with a DEX, you expose sensitive information. Your balance, your history, your strategy  all visible to everyone.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
