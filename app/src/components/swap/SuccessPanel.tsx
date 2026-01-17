interface SuccessPanelProps {
    signature: string;
    onReset: () => void;
}

export function SuccessPanel({ signature, onReset }: SuccessPanelProps) {
    return (
        <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(34, 211, 238, 0.1)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent-primary)' }}>✓ Swap Complete</p>
            <a
                href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] underline opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-primary)' }}
            >
                View on Explorer →
            </a>
            <button
                onClick={onReset}
                className="mt-2 w-full py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-white/10"
                style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
            >
                New Swap
            </button>
        </div>
    );
}
