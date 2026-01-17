use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,

    #[msg("Invalid ZK proof")]
    InvalidProof,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Insufficient liquidity in pool")]
    InsufficientLiquidity,

    #[msg("Invalid verifier program - cannot use System Program")]
    InvalidVerifier,
}
