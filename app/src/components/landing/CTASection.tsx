'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Particles } from '@/components/ui/particles';

export const CTASection = () => {
    return (
        <section className="p-4 md:p-6">
            <div className="section-bg-techstack rounded-3xl py-16 md:py-24 relative overflow-hidden">

                <Particles className="absolute inset-0 z-0" color="#ffffff" quantity={50} size={0.4} />

                <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal tracking-tight mb-4 md:mb-6 leading-tight">
                        <span className="text-white/95">Ready to Trade</span><br />
                        <span className="text-violet-400/90">with Eligibility Privacy?</span>
                    </h2>
                    <p className="text-white/60 text-base md:text-lg font-light max-w-xl mx-auto mb-8 md:mb-10">
                        Connect your wallet and try private eligibility swaps on Solana
                    </p>
                    <WalletMultiButton />

                    <div className="mt-12 flex items-center justify-center gap-8 text-white/40 text-sm">
                        <a href="https://github.com/Some1Uknow/shadow" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                            GitHub
                        </a>
                        <a href="https://explorer.solana.com/tx/4AeG6yqyqfRhJzBy2apTcCrVEDsEwqgHWsc8uFvdaKnseuYB8SjWC83KidujaELqe6sqGTUhdkK4eCzgNWWnbv3W?cluster=devnet" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                            View Demo TX
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};
