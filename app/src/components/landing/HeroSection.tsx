'use client';

import Image from 'next/image';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Particles } from '@/components/ui/particles';
import { GitHubStarButton } from '@/components/GitHubStarButton';

export const HeroSection = () => {
    return (
        <section className="p-4 md:p-6 lg:p-8">
            <div className="hero-bg rounded-3xl min-h-[90vh] flex flex-col relative overflow-hidden">

                <Particles className="absolute inset-0 z-0" color="#22d3ee" quantity={40} size={0.6} />

                <header className="px-6 md:px-8 pt-6 md:pt-8 pb-4 flex justify-between items-start relative z-10 animate-page-enter">
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10">
                            <Image src="/logo.png" alt="Shadow Logo" fill className="object-contain" />
                        </div>
                        <div className="text-2xl font-normal text-white/90 tracking-tight">Shadow</div>
                    </div>
                    <div className="flex items-center gap-4">
                        <GitHubStarButton />
                        <WalletMultiButton />
                    </div>
                </header>

                <div className="flex-1 flex items-center px-6 md:px-8 pb-12 md:pb-20 relative z-10">
                    <div className="w-full max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                            <div className="space-y-6">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 animate-page-enter-delay-1">
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                    <span className="text-sm text-white/70">Live on Devnet</span>
                                </div>
                                <h1 className="text-5xl md:text-6xl lg:text-7xl font-normal tracking-tight text-white/95 leading-tight animate-page-enter-delay-1">
                                    ZK Gated Swaps<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                                        on Solana.
                                    </span>
                                </h1>
                                <p className="text-lg md:text-xl text-white/60 font-light leading-relaxed max-w-xl animate-page-enter-delay-2">
                                    Swap through a shielded pool and prove eligibility without exposing balances or addresses. 
                                </p>

                                <div className="pt-4 animate-page-enter-delay-3">
                                    <p className="text-sm text-white/40 font-light mb-4 uppercase tracking-wider">Powered By</p>
                                    <div className="flex items-center gap-6 md:gap-8 flex-wrap">
                                        <div className="relative w-20 h-16 md:w-24 md:h-20 opacity-70 hover:opacity-100 transition-opacity">
                                            <Image src="/noir-logo.png" alt="Noir" fill className="object-contain" />
                                        </div>
                                        <div className="relative w-20 h-16 md:w-24 md:h-20 opacity-70 hover:opacity-100 transition-opacity">
                                            <Image src="/solana-logo.png" alt="Solana" fill className="object-contain" />
                                        </div>
                                        <div className="relative w-20 h-16 md:w-24 md:h-20 opacity-70 hover:opacity-100 transition-opacity">
                                            <Image src="/quicknode-logo.png" alt="QuickNode" fill className="object-contain" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative backdrop-blur-sm bg-white/5 rounded-3xl p-8 md:p-10 shadow-2xl animate-card-enter-delay-2">
                                <h2 className="text-2xl md:text-3xl font-normal text-white/95 mb-4 tracking-tight">
                                    Start Trading
                                </h2>
                                <p className="text-base md:text-lg text-white/50 mb-6 font-light leading-relaxed">
                                    Connect your wallet to access private eligibility swaps on Solana.
                                </p>

                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center gap-3 text-white/70">
                                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">1</div>
                                        <span className="text-sm">Deposit into the shielded pool</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-white/70">
                                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">2</div>
                                        <span className="text-sm">Generate a shielded spend proof</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-white/70">
                                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">3</div>
                                        <span className="text-sm">Relayer submits the swap, proof verified on chain</span>
                                    </div>
                                </div>

                                <WalletMultiButton />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
