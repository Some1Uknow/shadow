'use client';

import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Particles } from '@/components/ui/particles';
import { BorderBeam } from '@/components/ui/border-beam';

export default function Home() {
  const { connected } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (connected) {
      router.push('/swap');
    }
  }, [connected, router]);

  return (
    <main className="min-h-screen bg-black">
      {/* Hero Section - floating container with bg.png */}
      <section className="p-4 md:p-6 lg:p-8">
        <div className="hero-bg rounded-3xl min-h-[90vh] flex flex-col relative overflow-hidden">
          <Particles className="absolute inset-0 z-0" color="#22d3ee" quantity={40} size={0.6} />

          <header className="px-6 md:px-8 pt-6 md:pt-8 pb-4 flex justify-between items-start relative z-10">
            <div className="text-2xl font-normal text-white/90 tracking-tight">Shadow</div>
            <WalletMultiButton />
          </header>

          <div className="flex-1 flex items-center px-6 md:px-8 pb-12 md:pb-20 relative z-10">
            <div className="w-full max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h1 className="text-6xl md:text-7xl lg:text-8xl font-normal tracking-tight text-white/95">
                    Shadow
                  </h1>
                  <p className="text-lg md:text-xl lg:text-2xl text-white/70 font-light leading-relaxed max-w-2xl">
                    The first privacy-preserving DEX on Solana where you prove eligibility without revealing yourself
                  </p>

                  <div className="pt-6 md:pt-8">
                    <p className="text-sm text-white/50 font-light mb-4 uppercase tracking-wider">Built Using</p>
                    <div className="flex items-center gap-6 md:gap-8 flex-wrap">
                      <div className="relative w-20 h-20 md:w-24 md:h-24 opacity-80 hover:opacity-100 transition-opacity">
                        <Image src="/noir-logo.png" alt="Noir" fill className="object-contain" />
                      </div>
                      <div className="relative w-20 h-20 md:w-24 md:h-24 opacity-80 hover:opacity-100 transition-opacity">
                        <Image src="/solana-logo.png" alt="Solana" fill className="object-contain" />
                      </div>
                      <div className="relative w-28 h-20 md:w-32 md:h-24 opacity-80 hover:opacity-100 transition-opacity">
                        <Image src="/quicknode-logo.png" alt="QuickNode" fill className="object-contain" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative backdrop-blur-sm bg-white/5 rounded-3xl p-8 md:p-12 shadow-2xl">
                  <BorderBeam size={120} duration={8} colorFrom="#22d3ee" colorTo="#a78bfa" />
                  <h2 className="text-2xl md:text-3xl font-normal text-white/95 mb-4 md:mb-6 tracking-tight">
                    Connect Your Wallet
                  </h2>
                  <p className="text-base md:text-lg text-white/60 mb-8 md:mb-10 font-light leading-relaxed">
                    Access privacy-preserving trading on Solana. Prove your eligibility without revealing your holdings.
                  </p>
                  <WalletMultiButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - floating container */}
      <section className="p-4 md:p-6">
        <div className="section-bg-features rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <Particles className="absolute inset-0 z-0" color="#a78bfa" quantity={30} size={0.5} />

          <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="text-left space-y-6 md:space-y-8">
                <h2 className="text-4xl md:text-5xl lg:text-7xl font-normal text-white/95 tracking-tight leading-tight">
                  Core <br /> Features
                </h2>
                <p className="text-white/60 text-lg md:text-xl lg:text-2xl font-light leading-relaxed max-w-lg">
                  Privacy-first trading with zero-knowledge proofs on Solana. Experience DeFi without compromising your data.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <FeatureCard
                  title="Privacy Preserving"
                  description="Prove you meet trading requirements without revealing your actual balance or holdings."
                />
                <FeatureCard
                  title="Noir Circuits"
                  description="Powered by Noir ZK circuits with Groth16 proofs verified on-chain via Sunspot."
                />
                <FeatureCard
                  title="Solana Speed"
                  description="Sub-second finality with low fees. ZK verification adds minimal overhead."
                />
                <FeatureCard
                  title="Permissionless"
                  description="Open and accessible to anyone. No gatekeepers, just pure decentralized privacy."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Shadow Section - floating container */}
      <section className="p-4 md:p-6">
        <div className="section-bg-why rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 order-2 lg:order-1">
                <WhyCard
                  title="No Exposure"
                  description="Your wallet balance stays private. Prove eligibility with cryptographic proofs."
                />
                <WhyCard
                  title="Anti-MEV"
                  description="Hidden transaction details prevent MEV bots from exploiting your trades."
                />
                <WhyCard
                  title="Compliance"
                  description="Prove you meet requirements without revealing sensitive data."
                />
                <WhyCard
                  title="Solana First"
                  description="Pioneering ZK-proof based privacy on the fastest blockchain in DeFi."
                />
              </div>
              <div className="text-left space-y-6 md:space-y-8 order-1 lg:order-2">
                <h2 className="text-4xl md:text-5xl lg:text-7xl font-normal text-white/95 tracking-tight leading-tight">
                  Why <br /> Shadow DEX
                </h2>
                <p className="text-white/60 text-lg md:text-xl lg:text-2xl font-light leading-relaxed max-w-lg">
                  The future of private DeFi trading. built for speed, transparency, and total sovereignty over your financial data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section - floating container */}
      <section className="p-4 md:p-6">
        <div className="section-bg-howitworks rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="text-left space-y-6 md:space-y-8">
                <h2 className="text-4xl md:text-5xl lg:text-7xl font-normal text-white/95 tracking-tight leading-tight">
                  How It <br /> Works
                </h2>
                <p className="text-white/60 text-lg md:text-xl lg:text-2xl font-light leading-relaxed max-w-lg">
                  Four simple steps to private trading. Connect, prove, trade, and stay hidden.
                </p>
              </div>
              <div className="w-full relative">
                <HowItWorksBeam />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - floating container */}
      <section className="p-4 md:p-6">
        <div className="section-bg-cta rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <Particles className="absolute inset-0 z-0" color="#ffffff" quantity={50} size={0.4} />

          <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal text-white/95 tracking-tight mb-4 md:mb-6">
              Ready to Trade Privately?
            </h2>
            <p className="text-white/60 text-base md:text-lg font-light max-w-xl mx-auto mb-8 md:mb-10">
              Connect your wallet and experience the future of private DeFi on Solana
            </p>
            <WalletMultiButton />
          </div>
        </div>
      </section>

      {/* Footer - black background */}
      <footer className="py-12 md:py-16 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <p className="text-2xl font-normal text-white/90 tracking-tight mb-2">Shadow DEX</p>
              <p className="text-white/40 text-sm font-light">Privacy-preserving trading on Solana</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-white/30 text-xs font-light">
                Powered by Noir v1.0.0-beta.18 | Anchor v0.32.1 | Sunspot
              </p>
              <p className="text-white/20 text-xs mt-2 font-light">
                Built for Solana Devnet
              </p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

import { useRef } from "react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { User, FileKey, RefreshCcw, ShieldCheck } from "lucide-react";

function HowItWorksBeam() {
  const containerRef = useRef<HTMLDivElement>(null);
  const div1Ref = useRef<HTMLDivElement>(null);
  const div2Ref = useRef<HTMLDivElement>(null);
  const div3Ref = useRef<HTMLDivElement>(null);
  const div4Ref = useRef<HTMLDivElement>(null);

  return (
    <div
      className="relative flex w-full max-w-4xl mx-auto items-center justify-between"
      ref={containerRef}
    >
      <div className="flex flex-col items-center gap-y-2 z-10 relative">
        <div
          ref={div1Ref}
          className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-[0_0_20px_-12px_rgba(255,255,255,0.8)]"
        >
          <User className="text-white/80" size={28} />
        </div>
        <div className="absolute top-20 text-center w-32">
          <h3 className="text-white/90 font-medium mb-1">Connect</h3>
          <p className="text-white/50 text-xs">Link your Solana wallet</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-y-2 z-10 relative">
        <div
          ref={div2Ref}
          className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-[0_0_20px_-12px_rgba(255,255,255,0.8)]"
        >
          <FileKey className="text-white/80" size={28} />
        </div>
        <div className="absolute top-20 text-center w-32">
          <h3 className="text-white/90 font-medium mb-1">Generate Proof</h3>
          <p className="text-white/50 text-xs">Create ZK eligibility proof</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-y-2 z-10 relative">
        <div
          ref={div3Ref}
          className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-[0_0_20px_-12px_rgba(255,255,255,0.8)]"
        >
          <RefreshCcw className="text-white/80" size={28} />
        </div>
        <div className="absolute top-20 text-center w-32">
          <h3 className="text-white/90 font-medium mb-1">Trade</h3>
          <p className="text-white/50 text-xs">Swap with privacy verification</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-y-2 z-10 relative">
        <div
          ref={div4Ref}
          className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-[0_0_20px_-12px_rgba(255,255,255,0.8)]"
        >
          <ShieldCheck className="text-white/80" size={28} />
        </div>
        <div className="absolute top-20 text-center w-32">
          <h3 className="text-white/90 font-medium mb-1">Stay Private</h3>
          <p className="text-white/50 text-xs">Holdings remain hidden</p>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div1Ref}
        toRef={div2Ref}
        curvature={20}
        pathColor="rgba(255, 255, 255, 0.2)"
        gradientStartColor="#22d3ee"
        gradientStopColor="#a78bfa"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div2Ref}
        toRef={div3Ref}
        curvature={-20}
        pathColor="rgba(255, 255, 255, 0.2)"
        gradientStartColor="#a78bfa"
        gradientStopColor="#22d3ee"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div3Ref}
        toRef={div4Ref}
        curvature={20}
        pathColor="rgba(255, 255, 255, 0.2)"
        gradientStartColor="#22d3ee"
        gradientStopColor="#a78bfa"
      />
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="relative backdrop-blur-sm bg-white/5 rounded-2xl p-6 md:p-8 transition-all duration-300 hover:bg-white/[0.07] group overflow-hidden">
      <BorderBeam size={80} duration={10} colorFrom="#22d3ee" colorTo="#a78bfa" borderWidth={1} />
      <h3 className="text-lg md:text-xl font-normal text-white/90 mb-3 tracking-tight">{title}</h3>
      <p className="text-white/60 text-sm font-light leading-relaxed">{description}</p>
    </div>
  );
}

function WhyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="relative p-6 md:p-8 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 overflow-hidden">
      <BorderBeam size={60} duration={12} colorFrom="#a78bfa" colorTo="#22d3ee" borderWidth={1} />
      <h3 className="text-lg md:text-xl font-normal text-white/90 mb-3 tracking-tight">{title}</h3>
      <p className="text-white/60 text-sm font-light leading-relaxed">{description}</p>
    </div>
  );
}


