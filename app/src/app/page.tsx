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
      {/* Hero Section */}
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
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="text-sm text-white/70">Live on Devnet</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-normal tracking-tight text-white/95 leading-tight">
                    Prove You&apos;re Eligible.<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                      Keep Your Balance Private.
                    </span>
                  </h1>
                  <p className="text-lg md:text-xl text-white/60 font-light leading-relaxed max-w-xl">
                    The first DEX on Solana where you verify eligibility using zero-knowledge proofs — without exposing your wallet balance.
                  </p>

                  <div className="pt-4">
                    <p className="text-sm text-white/40 font-light mb-4 uppercase tracking-wider">Powered By</p>
                    <div className="flex items-center gap-6 md:gap-8 flex-wrap">
                      <div className="relative w-20 h-16 md:w-24 md:h-20 opacity-70 hover:opacity-100 transition-opacity">
                        <Image src="/noir-logo.png" alt="Noir" fill className="object-contain" />
                      </div>
                      <div className="relative w-20 h-16 md:w-24 md:h-20 opacity-70 hover:opacity-100 transition-opacity">
                        <Image src="/solana-logo.png" alt="Solana" fill className="object-contain" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative backdrop-blur-sm bg-white/5 rounded-3xl p-8 md:p-10 shadow-2xl">
                  <BorderBeam size={120} duration={8} colorFrom="#22d3ee" colorTo="#a78bfa" />
                  <h2 className="text-2xl md:text-3xl font-normal text-white/95 mb-4 tracking-tight">
                    Start Trading
                  </h2>
                  <p className="text-base md:text-lg text-white/50 mb-6 font-light leading-relaxed">
                    Connect your wallet to access ZK-verified swaps on Solana.
                  </p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-white/70">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">1</div>
                      <span className="text-sm">Generate ZK proof of your balance</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/70">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">2</div>
                      <span className="text-sm">Proof verified on-chain (Groth16)</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/70">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">3</div>
                      <span className="text-sm">Swap executes — balance stays private</span>
                    </div>
                  </div>
                  
                  <WalletMultiButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="p-4 md:p-6">
        <div className="section-bg-features rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-normal text-white/95 tracking-tight mb-4">
                The Problem with DeFi Today
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                Every time you interact with a DEX, you expose sensitive information
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ProblemCard
                emoji="👀"
                title="Balance Exposure"
                description="Anyone can see exactly how much you hold in your wallet"
              />
              <ProblemCard
                emoji="🤖"
                title="Front-Running"
                description="Bots see your pending trades and jump ahead for profit"
              />
              <ProblemCard
                emoji="🎯"
                title="Whale Tracking"
                description="Large holders become targets for scams and social engineering"
              />
              <ProblemCard
                emoji="📋"
                title="KYC Paradox"
                description="Proving eligibility requires exposing the data you want private"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="p-4 md:p-6">
        <div className="section-bg-why rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <Particles className="absolute inset-0 z-0" color="#a78bfa" quantity={30} size={0.5} />
          
          <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal text-white/95 tracking-tight leading-tight">
                  Our Solution:<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                    Prove Without Revealing
                  </span>
                </h2>
                <p className="text-white/60 text-lg md:text-xl font-light leading-relaxed">
                  Shadow uses zero-knowledge proofs to verify you meet trading requirements — without exposing your actual balance.
                </p>
                
                <div className="p-6 rounded-2xl bg-black/30 border border-white/10">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <span className="text-red-400 text-xl">✗</span>
                      <div>
                        <p className="text-white/80 font-medium">Traditional DEX</p>
                        <p className="text-white/50 text-sm">&quot;I have $147,832.51&quot; → Everyone knows your balance</p>
                      </div>
                    </div>
                    <div className="h-px bg-white/10"></div>
                    <div className="flex items-start gap-4">
                      <span className="text-green-400 text-xl">✓</span>
                      <div>
                        <p className="text-white/80 font-medium">Shadow DEX</p>
                        <p className="text-white/50 text-sm">&quot;I can prove I have ≥ $100,000&quot; → Actual balance stays private</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SolutionCard
                  title="Private Eligibility"
                  description="Prove you meet thresholds without revealing exact amounts"
                />
                <SolutionCard
                  title="On-Chain Verification"
                  description="Groth16 proofs verified directly on Solana (~470k CU)"
                />
                <SolutionCard
                  title="Noir Circuits"
                  description="Write ZK proofs in a simple, auditable language"
                />
                <SolutionCard
                  title="Solana Speed"
                  description="Sub-second finality with minimal overhead"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="p-4 md:p-6">
        <div className="section-bg-howitworks rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-normal text-white/95 tracking-tight mb-4">
                Real-World Use Cases
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                ZK-verified eligibility enables new possibilities in DeFi
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <UseCaseCard
                title="Accredited Investor Pools"
                description="Prove you meet the $1M threshold without revealing your exact net worth"
              />
              <UseCaseCard
                title="Whale-Only Trading"
                description="Access exclusive pools by proving you hold 10,000+ tokens — without showing your full stack"
              />
              <UseCaseCard
                title="KYC-Compliant DeFi"
                description="Prove your identity is verified without sharing documents on-chain"
              />
              <UseCaseCard
                title="DAO Governance"
                description="Prove voting eligibility without revealing your voting power to others"
              />
              <UseCaseCard
                title="Whitelist Access"
                description="Prove you're on the presale list without exposing which address you used"
              />
              <UseCaseCard
                title="Credit-Gated Lending"
                description="Prove your credit score meets requirements without revealing the exact number"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="p-4 md:p-6">
        <div className="rounded-3xl py-16 md:py-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.05), rgba(167, 139, 250, 0.05))' }}>
          <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-normal text-white/95 tracking-tight mb-4">
                How It Works
              </h2>
            </div>
            
            <div className="w-full relative">
              <HowItWorksBeam />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="p-4 md:p-6">
        <div className="section-bg-cta rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <Particles className="absolute inset-0 z-0" color="#ffffff" quantity={50} size={0.4} />

          <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal text-white/95 tracking-tight mb-4 md:mb-6">
              Ready to Trade with Privacy?
            </h2>
            <p className="text-white/60 text-base md:text-lg font-light max-w-xl mx-auto mb-8 md:mb-10">
              Connect your wallet and experience ZK-verified trading on Solana
            </p>
            <WalletMultiButton />
            
            <div className="mt-12 flex items-center justify-center gap-8 text-white/40 text-sm">
              <a href="https://github.com/your-repo/shadow" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                GitHub →
              </a>
              <a href="https://explorer.solana.com/tx/4XRjkS2WtHC6UQAiWSRtsLxkg73j8dyS4ChEUGUUgm8tWsNHEQ5cNGPbfjRQ6BacacicRTmqmCWi6CGxLv1qsuPt?cluster=devnet" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                View Demo TX →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 md:py-16 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <p className="text-2xl font-normal text-white/90 tracking-tight mb-2">Shadow DEX</p>
              <p className="text-white/40 text-sm font-light">ZK-verified trading on Solana</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-white/30 text-xs font-light">
                Noir + Groth16 + Solana
              </p>
              <p className="text-white/20 text-xs mt-2 font-light">
                Built for Hackathon
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
          <p className="text-white/50 text-xs">Link your wallet</p>
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
          <p className="text-white/50 text-xs">ZK proof of eligibility</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-y-2 z-10 relative">
        <div
          ref={div3Ref}
          className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-[0_0_20px_-12px_rgba(255,255,255,0.8)]"
        >
          <ShieldCheck className="text-white/80" size={28} />
        </div>
        <div className="absolute top-20 text-center w-32">
          <h3 className="text-white/90 font-medium mb-1">Verify On-Chain</h3>
          <p className="text-white/50 text-xs">Groth16 verification</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-y-2 z-10 relative">
        <div
          ref={div4Ref}
          className="z-10 flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-[0_0_20px_-12px_rgba(255,255,255,0.8)]"
        >
          <RefreshCcw className="text-white/80" size={28} />
        </div>
        <div className="absolute top-20 text-center w-32">
          <h3 className="text-white/90 font-medium mb-1">Swap</h3>
          <p className="text-white/50 text-xs">Trade with privacy</p>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div1Ref}
        toRef={div2Ref}
        curvature={20}
        pathColor="rgba(255, 255, 255, 0.15)"
        pathWidth={2}
        gradientStartColor="#22d3ee"
        gradientStopColor="#a78bfa"
        startXOffset={32}
        endXOffset={-32}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div2Ref}
        toRef={div3Ref}
        curvature={-20}
        pathColor="rgba(255, 255, 255, 0.15)"
        pathWidth={2}
        gradientStartColor="#a78bfa"
        gradientStopColor="#22d3ee"
        startXOffset={32}
        endXOffset={-32}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div3Ref}
        toRef={div4Ref}
        curvature={20}
        pathColor="rgba(255, 255, 255, 0.15)"
        pathWidth={2}
        gradientStartColor="#22d3ee"
        gradientStopColor="#a78bfa"
        startXOffset={32}
        endXOffset={-32}
      />
    </div>
  );
}

function ProblemCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
      <span className="text-3xl mb-4 block">{emoji}</span>
      <h3 className="text-lg font-medium text-white/90 mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function SolutionCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="relative backdrop-blur-sm bg-white/[0.03] rounded-2xl p-6 transition-all duration-300 hover:bg-white/[0.06] overflow-hidden">
      <BorderBeam size={80} duration={10} colorFrom="#22d3ee" colorTo="#a78bfa" borderWidth={1} />
      <h3 className="text-lg font-medium text-white/90 mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function UseCaseCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
      <h3 className="text-lg font-medium text-white/90 mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
