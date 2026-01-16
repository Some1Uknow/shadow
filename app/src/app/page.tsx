'use client';

import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Particles } from '@/components/ui/particles';
import { AnimatedBeam } from '@/components/ui/animated-beam';

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
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5">
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

      {/* Problem Section - Text Right, Cards Left */}
      <section className="p-4 md:p-6">
        <div className="section-bg-features rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Cards Left */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 order-2 lg:order-1">
                <ProblemCard
                  title="Balance Exposure"
                  description="Anyone can see exactly how much you hold in your wallet"
                />
                <ProblemCard
                  title="Front-Running"
                  description="Bots see your pending trades and jump ahead for profit"
                />
                <ProblemCard
                  title="Whale Tracking"
                  description="Large holders become targets for scams and social engineering"
                />
                <ProblemCard
                  title="KYC Paradox"
                  description="Proving eligibility requires exposing the data you want private"
                />
              </div>
              
              {/* Text Right */}
              <div className="space-y-6 order-1 lg:order-2">
                <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-tight">
                  <span className="text-white/95">The Problem with</span><br />
                  <span className="text-orange-400/90">DeFi Today</span>
                </h2>
                <p className="text-white/50 text-lg md:text-xl font-light leading-relaxed max-w-lg">
                  Every time you interact with a DEX, you expose sensitive information. Your balance, your history, your strategy — all visible to everyone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section - Text Left, Circuits Right */}
      <section className="p-4 md:p-6">
        <div className="section-bg-why rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <Particles className="absolute inset-0 z-0" color="#a78bfa" quantity={30} size={0.5} />
          
          <div className="max-w-7xl mx-auto px-6 md:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Text Left */}
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight leading-tight">
                  <span className="text-white/95">Three Proofs.</span><br />
                  <span className="text-violet-400/90">Complete Privacy.</span>
                </h2>
                <p className="text-white/60 text-lg md:text-xl font-light leading-relaxed">
                  Verify eligibility without exposing sensitive data. Each proof type protects different information.
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
                        <p className="text-white/50 text-sm">Prove you have enough without showing how much</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Three Circuits Right */}
              <div className="space-y-4">
                <CircuitCard
                  name="Min Balance"
                  proof="Balance ≥ threshold"
                  private="Actual balance"
                  color="cyan"
                />
                <CircuitCard
                  name="Token Holder"
                  proof="Hold ≥ X of token Y"
                  private="Holdings & wallet"
                  color="violet"
                />
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
      </section>

      {/* Use Cases Section - Text Right, Cards Left */}
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
                  <span className="text-white/95">Real-World</span><br />
                  <span className="text-cyan-400/90">Use Cases</span>
                </h2>
                <p className="text-white/50 text-lg md:text-xl font-light leading-relaxed max-w-lg">
                  ZK-verified eligibility enables new possibilities in DeFi — from compliant institutional pools to private governance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section - Text Left, Visual Steps Right */}
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
                  A seamless flow from wallet connection to private swap execution. No manual proof generation — everything happens automatically.
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

      {/* CTA Section */}
      <section className="p-4 md:p-6">
        <div className="section-bg-techstack rounded-3xl py-16 md:py-24 relative overflow-hidden">
          <Particles className="absolute inset-0 z-0" color="#ffffff" quantity={50} size={0.4} />

          <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal tracking-tight mb-4 md:mb-6 leading-tight">
              <span className="text-white/95">Ready to Trade</span><br />
              <span className="text-violet-400/90">with Privacy?</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg font-light max-w-xl mx-auto mb-8 md:mb-10">
              Connect your wallet and experience ZK-verified trading on Solana
            </p>
            <WalletMultiButton />
            
            <div className="mt-12 flex items-center justify-center gap-8 text-white/40 text-sm">
              <a href="https://github.com/your-repo/shadow" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                GitHub
              </a>
              <a href="https://explorer.solana.com/tx/2ufhPj4hxNcMo8FcxQSuzFDvDvuQDVQD36kHkDSimdPMbxGaBah3NgWkSSzLX1KNerwYTxkZDUM4UDr2P4k2bA8h?cluster=devnet" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
                View Demo TX
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 md:py-16 bg-black">
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
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HowItWorksVisual() {
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
          <p className="text-white/50 text-sm">App checks eligibility in real-time</p>
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
          <p className="text-white/50 text-sm">ZK proof creates and verifies on-chain</p>
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
          <p className="text-white/50 text-sm">Trade completes, balance stays private</p>
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

function ProblemCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-black/30 hover:bg-black/40 transition-all duration-300">
      <h3 className="text-lg font-medium text-white/90 mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function SolutionCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="backdrop-blur-sm bg-white/[0.03] rounded-2xl p-6 transition-all duration-300 hover:bg-white/[0.06]">
      <h3 className="text-lg font-medium text-white/90 mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function UseCaseCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-black/20 hover:bg-black/30 transition-all duration-300">
      <h3 className="text-lg font-medium text-white/90 mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function CircuitCard({ name, proof, private: privateData, color }: { name: string; proof: string; private: string; color: 'cyan' | 'violet' | 'emerald' }) {
  const colorClasses = {
    cyan: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      glow: 'shadow-[0_0_20px_-12px_rgba(34,211,238,0.5)]',
    },
    violet: {
      bg: 'bg-violet-500/10',
      text: 'text-violet-400',
      glow: 'shadow-[0_0_20px_-12px_rgba(167,139,250,0.5)]',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      glow: 'shadow-[0_0_20px_-12px_rgba(52,211,153,0.5)]',
    },
  };

  const colors = colorClasses[color];

  return (
    <div className={`p-5 rounded-2xl bg-black/30 hover:bg-black/40 transition-all duration-300 ${colors.glow}`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <span className={`text-lg font-bold ${colors.text}`}>ZK</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-semibold ${colors.text} mb-3`}>{name}</h3>
          <div className="space-y-2">
            <div>
              <p className="text-white/80 text-sm font-medium mb-0.5">{proof}</p>
              <p className="text-white/40 text-xs">Keeps {privateData} private</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
