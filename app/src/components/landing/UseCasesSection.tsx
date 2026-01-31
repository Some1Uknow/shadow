'use client';

import { UseCaseCard } from './UseCaseCard';

export const UseCasesSection = () => {
    return (
        <section className="p-4 md:p-6">
            <div className="section-bg-cta rounded-3xl py-16 md:py-24 relative overflow-hidden">

                <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
                        {/* Cards Left - 2x2 Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 order-2 lg:order-1">
                            <UseCaseCard
                                title="Accredited Investors"
                                description="Prove you meet the $1M threshold without revealing your exact net worth"
                            />
                            <UseCaseCard
                                title="Whale-Only Pools"
                                description="Access exclusive pools by proving holdings without showing your full stack"
                            />
                            <UseCaseCard
                                title="DAO Governance"
                                description="Prove voting eligibility without revealing your voting power"
                            />
                            <UseCaseCard
                                title="Sanctions Compliance"
                                description="Prove you're not on a blacklist without exposing your wallet"
                            />
                        </div>

                        {/* Text Right */}
                        <div className="space-y-6 order-1 lg:order-2 lg:sticky lg:top-8">
                            <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-tight">
                                <span className="text-white/95">Real World</span><br />
                                <span className="text-cyan-400/90">Use Cases</span>
                            </h2>
                            <p className="text-white/50 text-lg md:text-xl font-light leading-relaxed max-w-lg">
                                Private eligibility unlocks new pools and rules without exposing user data.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
