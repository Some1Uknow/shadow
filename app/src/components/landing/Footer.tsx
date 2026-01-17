'use client';

export const Footer = () => {
    return (
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
    );
};
