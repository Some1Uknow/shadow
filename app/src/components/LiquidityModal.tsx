
'use client';

import { useState } from 'react';
import { useAddLiquidity } from '@/hooks/useAddLiquidity';
import { useWallet } from '@solana/wallet-adapter-react';

interface LiquidityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    balanceA: number;
    balanceB: number;
}

export function LiquidityModal({ isOpen, onClose, onSuccess, balanceA, balanceB }: LiquidityModalProps) {
    const { publicKey } = useWallet();
    const { addLiquidity, isAdding, error } = useAddLiquidity();

    const [amountA, setAmountA] = useState('0');
    const [amountB, setAmountB] = useState('0');
    const [signature, setSignature] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!publicKey) return;

        try {
            const sig = await addLiquidity(Number(amountA), Number(amountB));
            setSignature(sig);
            onSuccess?.();
        } catch (err) {
            // Error handled by hook
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                className="w-full max-w-md p-6 rounded-2xl relative"
                style={{
                    background: 'rgba(20, 20, 30, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    Add Liquidity
                </h2>
                <p className="text-sm text-gray-400 mb-6">
                    Deposit tokens to earn fees.
                </p>

                {signature ? (
                    <div className="text-center py-6">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-white font-medium mb-2">Liquidity Added!</h3>
                        <a
                            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 underline block mb-6"
                        >
                            View Transaction
                        </a>
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 rounded-lg font-medium text-sm transition-all"
                            style={{
                                background: 'var(--accent-primary)',
                                color: '#000'
                            }}
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                    <label className="font-medium is-required">Token A</label>
                                    <span>Bal: {balanceA}</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amountA}
                                        onChange={(e) => setAmountA(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500/50 outline-none transition-colors"
                                        required
                                        min="0"
                                        step="any"
                                    />
                                    <span className="absolute right-3 top-2 text-xs text-gray-500">TOK</span>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                    <label className="font-medium is-required">Token B</label>
                                    <span>Bal: {balanceB}</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amountB}
                                        onChange={(e) => setAmountB(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500/50 outline-none transition-colors"
                                        required
                                        min="0"
                                        step="any"
                                    />
                                    <span className="absolute right-3 top-2 text-xs text-gray-500">TOK</span>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isAdding || !publicKey}
                            className="w-full py-3 rounded-xl font-medium text-sm transition-all relative overflow-hidden group mt-2"
                            style={{
                                background: 'linear-gradient(to right, var(--accent-secondary), var(--accent-primary))',
                                color: '#000',
                                opacity: isAdding ? 0.7 : 1
                            }}
                        >
                            {isAdding ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Adding Liquidity...
                                </span>
                            ) : (
                                "Add Liquidity"
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
