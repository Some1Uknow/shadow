'use client';

import { Particles } from '@/components/ui/particles';
import { CircuitCard } from './CircuitCard';

export const SolutionSection = () => {
    return (
        <section className="p-4 md:p-6">
            <div className="section-bg-why rounded-3xl py-16 md:py-24 relative overflow-hidden">

                <Particles className="absolute inset-0 z-0" color="#a78bfa" quantity={30} size={0.5} />

                <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                        {/* Text Left */}
                        <div className="space-y-8 animate-page-enter">
                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight leading-tight">
                                <span className="text-white/95">Three eligibility proofs.</span><br />
                                <span className="text-violet-400/90">One shielded spend.</span>
                            </h2>
                            <p className="text-white/60 text-lg md:text-xl font-light leading-relaxed">
                                Verify eligibility without exposing sensitive data. Amounts and recipients are visible on chain. The proofs keep eligibility and note ownership private.
                            </p>

                            <div className="p-6 rounded-2xl bg-black/30">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <span className="text-red-400 text-xl">✗</span>
                                        <div>
                                            <p className="text-white/80 font-medium">Traditional</p>
                                            <p className="text-white/50 text-sm">Show your balance to prove you have enough</p>
                                        </div>
                                    </div>
                                    <div className="h-px bg-white/10"></div>
                                    <div className="flex items-start gap-4">
                                        <span className="text-green-400 text-xl">✓</span>
                                        <div>
                                            <p className="text-white/80 font-medium">Shadow</p>
                                            <p className="text-white/50 text-sm">Prove you meet a threshold without revealing your exact holdings</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Three Circuits Right */}
                        <div className="space-y-4">
                            <div className="animate-card-enter">
                                <CircuitCard
                                    name="Min Balance"
                                    proof="Balance ≥ threshold"
                                    private="Actual balance"
                                    color="cyan"
                                />
                            </div>
                            <div className="animate-card-enter-delay-1">
                                <CircuitCard
                                    name="Token Holder"
                                    proof="Hold ≥ X of token Y"
                                    private="Holdings & wallet"
                                    color="violet"
                                />
                            </div>
                            <div className="animate-card-enter-delay-2">
                                <CircuitCard
                                    name="Not Blacklisted"
                                    proof="Not on sanctions list"
                                    private="Wallet address"
                                    color="emerald"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
