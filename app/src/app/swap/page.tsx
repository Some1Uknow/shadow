'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SwapInterface } from '@/components/SwapInterface';
import { PoolInfo } from '@/components/PoolInfo';
import { ProofStatus } from '@/components/ProofStatus';

interface ProofContext {
    balance: number;
    threshold: number;
    generatedAt: number;
}

export default function SwapPage() {
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();
    const router = useRouter();
    const [balance, setBalance] = useState<number>(0);
    const [proofGenerated, setProofGenerated] = useState(false);
    const [proofContext, setProofContext] = useState<ProofContext | null>(null);

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

    // Redirect to home if wallet disconnects
    useEffect(() => {
        if (!connected) {
            router.push('/');
        }
    }, [connected, router]);

    // Apply DEX mode styling
    useEffect(() => {
        document.body.classList.add('dex-mode');
        return () => document.body.classList.remove('dex-mode');
    }, []);

    // Show nothing while redirecting
    if (!connected) {
        return null;
    }

    return (
        <div className="min-h-screen p-4 flex flex-col gap-4" style={{ background: 'var(--bg-primary)' }}>
            {/* Header - Glassmorphic Panel */}
            <header className="glass-panel px-6 py-4 flex items-center justify-between" style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('/header.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        Shadow
                    </h1>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34, 211, 238, 0.15)', color: 'var(--accent-primary)' }}>
                        Devnet
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right mr-2">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Balance</p>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {balance.toFixed(4)} SOL
                        </p>
                    </div>
                    <WalletMultiButton />
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-4">
                {/* Left - Pool Info Panel */}
                <aside className="w-96 glass-panel p-6 overflow-y-auto" style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('/pool.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <PoolInfo />
                </aside>

                {/* Center - Swap Interface Panel */}
                <main className="flex-1 flex items-center justify-center glass-panel p-8" style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('/swap.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <div className="w-full max-w-md">
                        <SwapInterface
                            onProofGenerated={(context) => {
                                setProofGenerated(true);
                                setProofContext(context);
                            }}
                            onProofReset={() => {
                                setProofGenerated(false);
                                setProofContext(null);
                            }}
                            proofGenerated={proofGenerated}
                        />
                    </div>
                </main>
            </div>

            {/* Footer - ZK Proof Status Panel */}
            <footer className="glass-panel" style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('/footer.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <ProofStatus proofGenerated={proofGenerated} proofContext={proofContext} />
            </footer>
        </div>
    );
}
