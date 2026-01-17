interface SwapDetailsProps {
    fromToken: string;
    toToken: string;
    rate: number;
    priceImpact: number;
    minOutput: number;
}

export function SwapDetails({ fromToken, toToken, rate, priceImpact, minOutput }: SwapDetailsProps) {
    return (
        <div className="p-2.5 rounded-lg space-y-1.5" style={{ background: 'rgba(0, 0, 0, 0.20)' }}>
            <div className="flex justify-between text-[11px]">
                <span style={{ color: 'var(--text-muted)' }}>Rate</span>
                <span style={{ color: 'var(--text-primary)' }}>
                    1 {fromToken} = {rate.toFixed(4)} {toToken}
                </span>
            </div>
            <div className="flex justify-between text-[11px]">
                <span style={{ color: 'var(--text-muted)' }}>Impact</span>
                <span style={{ color: priceImpact > 5 ? 'var(--error)' : 'var(--text-primary)' }}>
                    {priceImpact.toFixed(2)}%
                </span>
            </div>
            <div className="flex justify-between text-[11px]">
                <span style={{ color: 'var(--text-muted)' }}>Min. Out</span>
                <span style={{ color: 'var(--text-primary)' }}>{minOutput.toFixed(4)} {toToken}</span>
            </div>
        </div>
    );
}
