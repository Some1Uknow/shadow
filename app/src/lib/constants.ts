/**
 * Application-wide constants
 * Centralized configuration to eliminate magic numbers
 */

// Fee configuration (matches Solana program)
// Fee configuration (matches Solana program)
export const FEE_BPS = 30;
export const FEE_NUMERATOR = 997;
export const FEE_DENOMINATOR = 1000;
export const K_DIVISOR = 1e18;

// Token configuration
export const TOKEN_DECIMALS = 9;
export const LAMPORTS_MULTIPLIER = 1e9;

// Transaction configuration
export const COMPUTE_UNITS = 500_000;
export const PRIORITY_FEE_MICROLAMPORTS = 1_000;

// UI configuration
export const BALANCE_POLL_INTERVAL_MS = 30_000;
export const DEBOUNCE_MS = 300;
export const SLIPPAGE_OPTIONS = [0.5, 1.0, 2.0] as const;
export const DEFAULT_SLIPPAGE_PERCENT = 1.0;

// Type exports
export type SlippageOption = typeof SLIPPAGE_OPTIONS[number];
