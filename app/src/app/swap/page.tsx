'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SwapInterface } from '@/components/swap';
import { PoolInfo } from '@/components/PoolInfo';
import { useImagePreload } from '@/hooks/useImagePreload';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

import { GitHubStarButton } from '@/components/GitHubStarButton';

export default function SwapPage() {
    const { publicKey, connected } = useWallet();
    const { connection } = useConnection();
    const router = useRouter();
    const [balance, setBalance] = useState<number>(0);
    const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);

    // Preload background images
    const headerLoaded = useImagePreload('/header.png');
    const poolLoaded = useImagePreload('/pool.png');
    const swapLoaded = useImagePreload('/swap.jpg');
    const footerLoaded = useImagePreload('/footer.png');

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

    // Refresh balance after swap
    useEffect(() => {
        if (lastTxSignature) {
            const timeout = setTimeout(fetchBalance, 2000);
            return () => clearTimeout(timeout);
        }
    }, [lastTxSignature, fetchBalance]);

    // Show nothing while redirecting
    if (!connected) {
        return null;
    }

    return (
        <div className="min-h-screen p-4 flex flex-col gap-4" style={{ background: 'var(--bg-primary)' }}>
            {/* Header - Glassmorphic Panel */}
            <header className="glass-panel px-6 py-4 flex items-center justify-between relative z-50" style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('/header.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="absolute inset-0 z-0 overflow-hidden rounded-[20px]">
                    <LoadingOverlay isLoading={!headerLoaded} />
                    <Image
                        src="/header.png"
                        alt="Header Background"
                        fill
                        className="object-cover opacity-60"
                        quality={80}
                    />
                    <div className="absolute inset-0 bg-black/40" />
                </div>
                <div className="flex items-center gap-3 relative z-10">
                    <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        Shadow
                    </h1>
                    <GitHubStarButton />
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34, 211, 238, 0.15)', color: 'var(--accent-primary)' }}>
                        Devnet
                    </span>
                </div>

                <div className="flex items-center gap-4 relative z-10">
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
                <aside className="w-96 glass-panel p-6 overflow-y-auto relative overflow-hidden" style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('/pool.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <LoadingOverlay isLoading={!poolLoaded} />
                    <PoolInfo />
                </aside>

                {/* Center - Swap Interface Panel */}
                <main className="flex-1 flex items-center justify-center glass-panel p-8 relative overflow-hidden" style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('/swap.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <LoadingOverlay isLoading={!swapLoaded} />
                    <div className="w-full max-w-md relative z-10">
                        <SwapInterface
                            onSwapComplete={(txSignature) => {
                                setLastTxSignature(txSignature);
                            }}
                        />
                    </div>
                </main>
            </div>

            {/* Footer - ZK Info Panel */}
            <footer className="glass-panel px-6 py-4 relative overflow-hidden" style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('/footer.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <LoadingOverlay isLoading={!footerLoaded} />
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                ZK-Verified Swaps
                            </span>
                        </div>
                        <div className="h-4 w-px" style={{ background: 'var(--border-primary)' }} />
                        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <span>Groth16 / BN254</span>
                            <span>•</span>
                            <span>Noir Circuits</span>
                            <span>•</span>
                            <span>Sunspot Verifier</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
                        <svg className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="text-xs font-medium" style={{ color: 'var(--accent-secondary)' }}>Privacy Preserved</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
