/**
 * AMM Math Utilities
 * Pure functions for constant product AMM calculations
 */

import { FEE_NUMERATOR, FEE_DENOMINATOR } from './constants';

/**
 * Calculate expected output using constant product formula with fee
 * 
 * Formula: amount_out = (amount_in * 997 * reserve_out) / (reserve_in * 1000 + amount_in * 997)
 * 
 * @param amountIn - Input amount (in token units, not lamports)
 * @param reserveIn - Reserve of input token
 * @param reserveOut - Reserve of output token
 * @returns Expected output amount
 */
export function calculateExpectedOutput(
    amountIn: number,
    reserveIn: number,
    reserveOut: number
): number {
    if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0;

    const inputWithFee = amountIn * FEE_NUMERATOR;
    const numerator = inputWithFee * reserveOut;
    const denominator = reserveIn * FEE_DENOMINATOR + inputWithFee;

    return numerator / denominator;
}

/**
 * Calculate price impact percentage
 * 
 * Compares execution price vs spot price to determine slippage
 * 
 * @param amountIn - Input amount
 * @param reserveIn - Reserve of input token
 * @param reserveOut - Reserve of output token
 * @param expectedOutput - Expected output from calculateExpectedOutput
 * @returns Price impact as a percentage (e.g., 2.5 for 2.5%)
 */
export function calculatePriceImpact(
    amountIn: number,
    reserveIn: number,
    reserveOut: number,
    expectedOutput: number
): number {
    if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0 || expectedOutput <= 0) return 0;

    const spotPrice = reserveOut / reserveIn;
    const executionPrice = expectedOutput / amountIn;

    return Math.abs((spotPrice - executionPrice) / spotPrice) * 100;
}

/**
 * Calculate minimum output with slippage tolerance
 * 
 * @param expectedOutput - Expected output amount
 * @param slippagePercent - Slippage tolerance (e.g., 1.0 for 1%)
 * @returns Minimum acceptable output
 */
export function calculateMinOutput(
    expectedOutput: number,
    slippagePercent: number
): number {
    return expectedOutput * (1 - slippagePercent / 100);
}

/**
 * Format token amount for display
 * 
 * @param amount - Amount in token units
 * @param decimals - Number of decimal places to show
 * @returns Formatted string
 */
export function formatTokenAmount(amount: number, decimals: number = 6): string {
    if (amount === 0) return '0';
    if (amount < 0.000001) return '<0.000001';
    return amount.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    });
}

/**
 * Get the current exchange rate
 * 
 * @param reserveIn - Reserve of input token
 * @param reserveOut - Reserve of output token
 * @returns Rate (1 input = X output)
 */
export function getExchangeRate(reserveIn: number, reserveOut: number): number {
    if (reserveIn <= 0 || reserveOut <= 0) return 0;
    return reserveOut / reserveIn;
}
