/**
 * Application Error Types
 * Standardized error handling for Shadow DEX
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface AppErrorDetails {
    message: string;
    code: string;
    severity?: ErrorSeverity;
    cause?: unknown;
}

export class AppError extends Error {
    public readonly code: string;
    public readonly severity: ErrorSeverity;
    public readonly cause?: unknown;

    constructor(details: AppErrorDetails) {
        super(details.message);
        this.name = 'AppError';
        this.code = details.code;
        this.severity = details.severity || 'error';
        this.cause = details.cause;
    }
}

// -----------------------------------------------------------------------------
// Swap Errors
// -----------------------------------------------------------------------------

export class SwapError extends AppError {
    constructor(message: string, code: string = 'SWAP_ERROR', cause?: unknown) {
        super({ message, code, cause, severity: 'error' });
        this.name = 'SwapError';
    }
}

export class InsufficientLiquidityError extends SwapError {
    constructor(message: string = 'Insufficient liquidity in the pool.') {
        super(message, 'INSUFFICIENT_LIQUIDITY');
        this.name = 'InsufficientLiquidityError';
    }
}

export class SlippageExceededError extends SwapError {
    constructor(message: string = 'Slippage tolerance exceeded.') {
        super(message, 'SLIPPAGE_EXCEEDED');
        this.name = 'SlippageExceededError';
    }
}

// -----------------------------------------------------------------------------
// Proof Errors
// -----------------------------------------------------------------------------

export class ProofGenerationError extends AppError {
    constructor(message: string, cause?: unknown) {
        super({
            message: `Proof generation failed: ${message}`,
            code: 'PROOF_GENERATION_FAILED',
            cause,
            severity: 'error',
        });
        this.name = 'ProofGenerationError';
    }
}

// -----------------------------------------------------------------------------
// Wallet/Connection Errors
// -----------------------------------------------------------------------------

export class WalletError extends AppError {
    constructor(message: string, cause?: unknown) {
        super({ message, code: 'WALLET_ERROR', cause, severity: 'warning' });
        this.name = 'WalletError';
    }
}

// -----------------------------------------------------------------------------
// Error Mapping Utility
// -----------------------------------------------------------------------------

export function mapErrorToUserMessage(error: unknown): string {
    if (error instanceof AppError) {
        return error.message;
    }

    if (error instanceof Error) {
        // Check for common Anchor/Solana error messages
        const msg = error.message;
        if (msg.includes('0x1')) return 'Insufficient funds for transaction';
        if (msg.includes('0x1770')) return 'Slippage tolerance exceeded';
        if (msg.includes('User rejected')) return 'Transaction rejected by user';

        return error.message;
    }

    return 'An unexpected error occurred';
}
