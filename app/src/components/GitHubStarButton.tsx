'use client';

import { useEffect, useState } from 'react';

function GithubIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
    );
}

function StarIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
    );
}

export function GitHubStarButton() {
    const [stars, setStars] = useState<string | null>(null);

    useEffect(() => {
        fetch('https://api.github.com/repos/Some1Uknow/shadow')
            .then(res => res.json())
            .then(data => {
                if (data.stargazers_count !== undefined) {
                    setStars(data.stargazers_count.toString());
                }
            })
            .catch(() => { });
    }, []);

    return (
        <a
            href="https://github.com/Some1Uknow/shadow"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 pr-3 pl-2.5 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-all duration-200 group no-underline"
            style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
            }}
        >
            <GithubIcon className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" />
            <div className="w-px h-3 bg-white/10 mx-0.5" />
            <div className="flex items-center gap-1">
                <StarIcon className="w-3.5 h-3.5 text-yellow-400 opacity-90 group-hover:opacity-100 transition-opacity" />
                <span className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors font-mono">
                    {stars || '...'}
                </span>
            </div>
        </a>
    );
}
