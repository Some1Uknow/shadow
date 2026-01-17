'use client';

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'glass' | 'solid' | 'outline';
    padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({
    children,
    variant = 'glass',
    padding = 'md',
    className = '',
    style,
    ...props
}: CardProps) {

    const baseStyles = "rounded-xl transition-all duration-200";

    const variants = {
        glass: "backdrop-blur-xl border border-white/5 shadow-xl",
        solid: "bg-[#0d0d0f] border border-white/5",
        outline: "border border-white/10 bg-transparent"
    };

    const paddings = {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-6"
    };

    const variantStyle = variant === 'glass' ? {
        background: 'rgba(20, 20, 22, 0.4)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
    } : {};

    return (
        <div
            className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${className}`}
            style={{ ...variantStyle, ...style }}
            {...props}
        >
            {children}
        </div>
    );
}
