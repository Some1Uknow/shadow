'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SwapInterface } from '@/components/SwapInterface';
import { PoolInfo } from '@/components/PoolInfo';
import { ProofStatus } from '@/components/ProofStatus';
import Image from 'next/image';

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number>(0);
  const [proofGenerated, setProofGenerated] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (publicKey) {
      try {
        const bal = await connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalance();
    }
  }, [connected, publicKey, fetchBalance]);

  return (
    <main className="min-h-screen relative">
      {/* Hero Section */}
      <div className="min-h-screen flex flex-col">
        {/* Header with Wallet */}
        <header className="px-8 pt-8 pb-4 flex justify-end items-start">
          <div className="flex items-center gap-6">
            {connected && (
              <div className="text-right">
                <p className="text-sm text-white/50 font-light mb-1">Balance</p>
                <p className="text-xl text-white/90 font-normal">{balance.toFixed(4)} SOL</p>
              </div>
            )}
            <WalletMultiButton />
          </div>
        </header>

        {/* Main Hero Content */}
        <div className="flex-1 flex items-center px-8 pb-20">
          <div className="w-full max-w-7xl mx-auto">
            {!connected ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Left Side - Title and Tagline */}
                <div className="space-y-6">
                  <h1 className="text-7xl md:text-8xl lg:text-9xl font-normal tracking-tight text-white/95">
                    Shadow
                  </h1>
                  <p className="text-xl md:text-2xl text-white/70 font-light leading-relaxed max-w-2xl">
                    The first privacy-preserving DEX on Solana where you prove eligibility without revealing yourself
                  </p>

                  {/* Built Using Section */}
                  <div className="pt-8">
                    <p className="text-sm text-white/50 font-light mb-4 uppercase tracking-wider">Built Using</p>
                    <div className="flex items-center gap-8">
                      <div className="relative w-24 h-24 opacity-80 hover:opacity-100 transition-opacity">
                        <Image
                          src="/noir-logo.png"
                          alt="Noir"
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="relative w-24 h-24 opacity-80 hover:opacity-100 transition-opacity">
                        <Image
                          src="/solana-logo.png"
                          alt="Solana"
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="relative w-32 h-24 opacity-80 hover:opacity-100 transition-opacity">
                        <Image
                          src="/quicknode-logo.png"
                          alt="QuickNode"
                          fill
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side - Connect Wallet Card */}
                <div className="backdrop-blur-sm bg-white/5 rounded-3xl p-12 border border-white/10 shadow-2xl">
                  <h2 className="text-3xl font-normal text-white/95 mb-6 tracking-tight">
                    Connect Your Wallet
                  </h2>
                  <p className="text-lg text-white/60 mb-10 font-light leading-relaxed">
                    Access privacy-preserving trading on Solana. Prove your eligibility without revealing your holdings.
                  </p>
                  <WalletMultiButton />
                </div>
              </div>
            ) : (
              <div className="w-full">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Pool Info */}
                  <div className="backdrop-blur-sm bg-white/5 rounded-2xl p-6 border border-white/10">
                    <PoolInfo />
                  </div>

                  {/* Swap Interface */}
                  <div className="backdrop-blur-sm bg-white/5 rounded-2xl p-6 border border-white/10">
                    <SwapInterface
                      onProofGenerated={() => setProofGenerated(true)}
                      proofGenerated={proofGenerated}
                    />
                  </div>

                  {/* Proof Status */}
                  <div className="backdrop-blur-sm bg-white/5 rounded-2xl p-6 border border-white/10">
                    <ProofStatus proofGenerated={proofGenerated} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="px-8 pb-16">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
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
          </div>
        </div>

        {/* Footer */}
        <footer className="px-8 pb-8 text-center">
          <p className="text-white/40 text-sm font-light">Shadow DEX — Built for Solana Devnet</p>
          <p className="text-white/30 text-xs mt-2 font-light">
            Powered by Noir v1.0.0-beta.18 | Anchor v0.32.1 | Sunspot
          </p>
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="backdrop-blur-sm bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300 hover:bg-white/[0.07]">
      <h3 className="text-xl font-normal text-white/90 mb-3 tracking-tight">{title}</h3>
      <p className="text-white/60 text-sm font-light leading-relaxed">{description}</p>
    </div>
  );
}
