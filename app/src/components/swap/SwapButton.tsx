import { PublicKey } from '@solana/web3.js';
import { Spinner } from './icons';

interface SwapButtonProps {
    canSwap: boolean;
    isSwapping: boolean;
    anyChecking: boolean;
    allMet: boolean;
    hasAmount: boolean;
    publicKey: PublicKey | null;
    onClick: () => void;
}

export function SwapButton({ canSwap, isSwapping, anyChecking, allMet, hasAmount, publicKey, onClick }: SwapButtonProps) {
    let label = 'Swap';
    if (!publicKey) label = 'Connect Wallet';
    else if (isSwapping) label = 'Swapping...';
    else if (anyChecking) label = 'Checking...';
    else if (!allMet && hasAmount) label = 'Requirements Not Met';

    return (
        <button
            onClick={onClick}
            disabled={!canSwap || !publicKey}
            aria-label={label}
            aria-busy={isSwapping || anyChecking}
            aria-disabled={!canSwap || !publicKey}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#0d0d0f' }}
        >
            {(isSwapping || anyChecking) ? (
                <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    <span role="status">{label}</span>
                </span>
            ) : label}
        </button>
    );
}
