'use client';

import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    width?: string | number;
    height?: string | number;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
}

export function Skeleton({
    width,
    height,
    variant = 'text',
    className = '',
    style,
    ...props
}: SkeletonProps) {

    const baseStyles = "animate-pulse bg-white/5";

    const variants = {
        text: "rounded h-4 w-full",
        circular: "rounded-full",
        rectangular: "rounded-none",
        rounded: "rounded-xl"
    };

    const computedStyle: React.CSSProperties = {
        width: width,
        height: height,
        ...style
    };

    return (
        <div
            className={`${baseStyles} ${variants[variant]} ${className}`}
            style={computedStyle}
            {...props}
        />
    );
}
