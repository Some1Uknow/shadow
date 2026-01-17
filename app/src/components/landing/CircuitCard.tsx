export function CircuitCard({ name, proof, private: privateData, color }: { name: string; proof: string; private: string; color: 'cyan' | 'violet' | 'emerald' }) {
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
