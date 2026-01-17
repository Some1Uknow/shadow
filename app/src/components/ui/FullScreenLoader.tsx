import { Spinner } from '@/components/swap/icons';

interface FullScreenLoaderProps {
    isLoading: boolean;
}

export function FullScreenLoader({ isLoading }: FullScreenLoaderProps) {
    if (!isLoading) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-700"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
            <div className="transform scale-[2] text-cyan-400 mb-6">
                <Spinner />
            </div>
            <div className="text-white/40 text-sm font-light tracking-widest uppercase animate-pulse">
                Entering Shadow...
            </div>
        </div>
    );
}
