import { Spinner } from '@/components/swap/icons';

interface LoadingOverlayProps {
    isLoading: boolean;
    className?: string; // Allow custom classes e.g. for rounded corners
}

export function LoadingOverlay({ isLoading, className = '' }: LoadingOverlayProps) {
    if (!isLoading) return null;

    return (
        <div
            className={`absolute inset-0 z-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-500 ${className}`}
            style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
            <div className="transform scale-150 text-cyan-400">
                <Spinner />
            </div>
        </div>
    );
}
