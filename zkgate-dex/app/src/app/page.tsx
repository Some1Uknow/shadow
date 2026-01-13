'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SwapInterface } from '@/components/SwapInterface';
import { PoolInfo } from '@/components/PoolInfo';
import { ProofStatus } from '@/components/ProofStatus';

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
    <main className="min-h-screen p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            ZKGate DEX
          </h1>
          <p className="text-gray-400 mt-2">
            Zero-Knowledge Gated Trading on Solana
          </p>
        </div>
        <div className="flex items-center gap-4">
          {connected && (
            <div className="text-right mr-4">
              <p className="text-sm text-gray-400">Balance</p>
              <p className="text-lg font-semibold">{balance.toFixed(4)} SOL</p>
            </div>
          )}
          <WalletMultiButton />
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        {!connected ? (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-2xl p-12 border border-purple-500/20">
              <h2 className="text-2xl font-semibold mb-4">
                Connect Your Wallet
              </h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Connect your Solana wallet to access ZK-gated trading. 
                Prove your eligibility without revealing your holdings.
              </p>
              <WalletMultiButton />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Pool Info */}
            <div className="lg:col-span-1">
              <PoolInfo />
            </div>

            {/* Center Column - Swap Interface */}
            <div className="lg:col-span-1">
              <SwapInterface 
                onProofGenerated={() => setProofGenerated(true)}
                proofGenerated={proofGenerated}
              />
            </div>

            {/* Right Column - Proof Status */}
            <div className="lg:col-span-1">
              <ProofStatus proofGenerated={proofGenerated} />
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
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
      <footer className="mt-20 text-center text-gray-500 text-sm">
        <p>ZKGate DEX - Built for Solana Devnet</p>
        <p className="mt-1">
          Powered by Noir v1.0.0-beta.18 | Anchor v0.32.1 | Sunspot
        </p>
      </footer>
    </main>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 hover:border-purple-500/50 transition-colors">
      <h3 className="text-lg font-semibold text-purple-400 mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}
