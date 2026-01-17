use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d");

// ============================================================================
// Constants
// ============================================================================

/// Fee basis points (30 = 0.3%)
pub const FEE_BPS: u64 = 30;
pub const FEE_DENOMINATOR: u64 = 10000;

/// Fee multiplier for constant product formula (997 = 1000 - 3, i.e., 0.3% fee)
const FEE_NUMERATOR: u128 = 997;
const FEE_DENOM: u128 = 1000;

// ============================================================================
// Program
// ============================================================================

#[program]
pub mod zkgate {
    use super::*;

    /// Initialize a new liquidity pool for token pair A/B
    pub fn create_pool(
        ctx: Context<CreatePool>,
        init_a: u64,
        init_b: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        pool.token_a_mint = ctx.accounts.token_a_mint.key();
        pool.token_b_mint = ctx.accounts.token_b_mint.key();
        pool.token_a_reserve = init_a;
        pool.token_b_reserve = init_b;
        pool.k = (init_a as u128)
            .checked_mul(init_b as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        pool.bump = ctx.bumps.pool;
        pool.authority = ctx.accounts.user.key();
        pool.total_fees_a = 0;
        pool.total_fees_b = 0;
        
        msg!("Pool created: A={}, B={}, K={}", init_a, init_b, pool.k);
        
        Ok(())
    }

    /// Add liquidity to the pool
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        // Transfer token A from user to reserve
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_a.to_account_info(),
                    to: ctx.accounts.token_a_reserve.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_a,
        )?;

        // Transfer token B from user to reserve
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_b.to_account_info(),
                    to: ctx.accounts.token_b_reserve.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_b,
        )?;

        // Update reserves
        let pool = &mut ctx.accounts.pool;
        pool.token_a_reserve = pool.token_a_reserve
            .checked_add(amount_a)
            .ok_or(ErrorCode::MathOverflow)?;
        pool.token_b_reserve = pool.token_b_reserve
            .checked_add(amount_b)
            .ok_or(ErrorCode::MathOverflow)?;
        
        // Update K
        pool.k = (pool.token_a_reserve as u128)
            .checked_mul(pool.token_b_reserve as u128)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!("Liquidity added: A={}, B={}", amount_a, amount_b);
        
        Ok(())
    }

    /// Execute a ZK-verified swap (A -> B)
    /// Requires a valid ZK proof that the user meets eligibility criteria
    pub fn zk_swap(
        ctx: Context<ZKSwap>,
        amount_in: u64,
        min_out: u64,
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
    ) -> Result<()> {
        // Step 1: Verify ZK proof
        verify_zk_proof(
            &ctx.accounts.verifier_program,
            &proof,
            &public_inputs,
        )?;

        // Step 2: Execute swap A -> B
        let amount_out = execute_swap(
            &mut ctx.accounts.pool,
            &ctx.accounts.token_program,
            ctx.accounts.user_token_a.to_account_info(),
            ctx.accounts.user_token_b.to_account_info(),
            ctx.accounts.token_a_reserve.to_account_info(),
            ctx.accounts.token_b_reserve.to_account_info(),
            &ctx.accounts.user,
            amount_in,
            min_out,
            SwapDirection::AToB,
        )?;

        msg!("Swap executed: {} A -> {} B", amount_in, amount_out);
        Ok(())
    }

    /// Execute a ZK-verified swap (B -> A)
    pub fn zk_swap_reverse(
        ctx: Context<ZKSwapReverse>,
        amount_in: u64,
        min_out: u64,
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
    ) -> Result<()> {
        // Step 1: Verify ZK proof
        verify_zk_proof(
            &ctx.accounts.verifier_program,
            &proof,
            &public_inputs,
        )?;

        // Step 2: Execute swap B -> A
        let amount_out = execute_swap(
            &mut ctx.accounts.pool,
            &ctx.accounts.token_program,
            ctx.accounts.user_token_b.to_account_info(),
            ctx.accounts.user_token_a.to_account_info(),
            ctx.accounts.token_b_reserve.to_account_info(),
            ctx.accounts.token_a_reserve.to_account_info(),
            &ctx.accounts.user,
            amount_in,
            min_out,
            SwapDirection::BToA,
        )?;

        msg!("Swap executed: {} B -> {} A", amount_in, amount_out);
        Ok(())
    }

    /// Get pool info (view function)
    pub fn get_pool_info(ctx: Context<GetPoolInfo>) -> Result<PoolInfo> {
        let pool = &ctx.accounts.pool;
        Ok(PoolInfo {
            token_a_mint: pool.token_a_mint,
            token_b_mint: pool.token_b_mint,
            token_a_reserve: pool.token_a_reserve,
            token_b_reserve: pool.token_b_reserve,
            k: pool.k,
            total_fees_a: pool.total_fees_a,
            total_fees_b: pool.total_fees_b,
        })
    }
}

// ============================================================================
// Swap Direction
// ============================================================================

#[derive(Clone, Copy, PartialEq)]
pub enum SwapDirection {
    AToB,
    BToA,
}

// ============================================================================
// Core Swap Logic
// ============================================================================

/// Execute a swap after ZK verification
/// 
/// This function handles all token transfers and state updates for both
/// swap directions (A->B and B->A).
fn execute_swap<'info>(
    pool: &mut Account<'info, Pool>,
    token_program: &Program<'info, Token>,
    user_token_in: AccountInfo<'info>,
    user_token_out: AccountInfo<'info>,
    reserve_in: AccountInfo<'info>,
    reserve_out: AccountInfo<'info>,
    user: &Signer<'info>,
    amount_in: u64,
    min_out: u64,
    direction: SwapDirection,
) -> Result<u64> {
    // Get current reserves based on direction
    let (reserve_in_amount, reserve_out_amount) = match direction {
        SwapDirection::AToB => (pool.token_a_reserve, pool.token_b_reserve),
        SwapDirection::BToA => (pool.token_b_reserve, pool.token_a_reserve),
    };

    // Calculate output amount
    let amount_out = get_amount_out(amount_in, reserve_in_amount, reserve_out_amount)?;
    
    // Check slippage tolerance
    require!(amount_out >= min_out, ErrorCode::SlippageExceeded);

    // Transfer tokens from user to pool
    token::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: user_token_in,
                to: reserve_in,
                authority: user.to_account_info(),
            },
        ),
        amount_in,
    )?;

    // Build PDA signer seeds
    let seeds = &[
        b"pool".as_ref(),
        pool.token_a_mint.as_ref(),
        pool.token_b_mint.as_ref(),
        &[pool.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer tokens from pool to user
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: reserve_out,
                to: user_token_out,
                authority: pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount_out,
    )?;

    // Update pool state
    let fee = calculate_fee(amount_in)?;
    
    match direction {
        SwapDirection::AToB => {
            pool.token_a_reserve = pool.token_a_reserve
                .checked_add(amount_in)
                .ok_or(ErrorCode::MathOverflow)?;
            pool.token_b_reserve = pool.token_b_reserve
                .checked_sub(amount_out)
                .ok_or(ErrorCode::MathOverflow)?;
            pool.total_fees_a = pool.total_fees_a
                .checked_add(fee)
                .ok_or(ErrorCode::MathOverflow)?;
        }
        SwapDirection::BToA => {
            pool.token_b_reserve = pool.token_b_reserve
                .checked_add(amount_in)
                .ok_or(ErrorCode::MathOverflow)?;
            pool.token_a_reserve = pool.token_a_reserve
                .checked_sub(amount_out)
                .ok_or(ErrorCode::MathOverflow)?;
            pool.total_fees_b = pool.total_fees_b
                .checked_add(fee)
                .ok_or(ErrorCode::MathOverflow)?;
        }
    }

    msg!("Fee collected: {}", fee);
    Ok(amount_out)
}

/// Calculate 0.3% fee from input amount
fn calculate_fee(amount: u64) -> Result<u64> {
    let fee = (amount as u128)
        .checked_mul(FEE_BPS as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(FEE_DENOMINATOR as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(fee as u64)
}

/// Calculate output amount using constant product formula with 0.3% fee
/// 
/// Formula: amount_out = (amount_in * 997 * reserve_out) / (reserve_in * 1000 + amount_in * 997)
fn get_amount_out(amount_in: u64, reserve_in: u64, reserve_out: u64) -> Result<u64> {
    require!(amount_in > 0, ErrorCode::ZeroAmount);
    require!(reserve_in > 0 && reserve_out > 0, ErrorCode::InsufficientLiquidity);

    let amount_in_with_fee = (amount_in as u128)
        .checked_mul(FEE_NUMERATOR)
        .ok_or(ErrorCode::MathOverflow)?;

    let numerator = amount_in_with_fee
        .checked_mul(reserve_out as u128)
        .ok_or(ErrorCode::MathOverflow)?;

    let denominator = (reserve_in as u128)
        .checked_mul(FEE_DENOM)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(amount_in_with_fee)
        .ok_or(ErrorCode::MathOverflow)?;

    let amount_out = numerator
        .checked_div(denominator)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(amount_out as u64)
}

// ============================================================================
// ZK Proof Verification
// ============================================================================

/// Verify ZK proof via CPI to the gnark-verifier-solana program
/// 
/// The gnark verifier expects instruction data as: proof_bytes || public_witness_bytes
/// No accounts are needed - verification is purely computational.
fn verify_zk_proof<'info>(
    verifier_program: &AccountInfo<'info>,
    proof: &[u8],
    public_inputs: &[u8],
) -> Result<()> {
    // SECURITY: Reject System Program as verifier to prevent bypass attacks
    let system_program_id = anchor_lang::solana_program::system_program::ID;
    require!(
        *verifier_program.key != system_program_id,
        ErrorCode::InvalidVerifier
    );

    msg!("Verifying ZK proof via CPI to: {}", verifier_program.key);
    msg!("Proof: {} bytes, Public inputs: {} bytes", proof.len(), public_inputs.len());

    // gnark-verifier expects instruction_data = proof_bytes || public_witness_bytes
    let mut instruction_data = Vec::with_capacity(proof.len() + public_inputs.len());
    instruction_data.extend_from_slice(proof);
    instruction_data.extend_from_slice(public_inputs);

    // gnark-verifier doesn't need any accounts - verification is purely computational
    let ix = Instruction {
        program_id: *verifier_program.key,
        accounts: vec![],
        data: instruction_data,
    };

    // Invoke the verifier program
    invoke(&ix, &[verifier_program.clone()]).map_err(|e| {
        msg!("ZK proof verification failed: {:?}", e);
        ErrorCode::InvalidProof
    })?;

    msg!("ZK proof verified successfully");
    Ok(())
}

// ============================================================================
// Account Structs
// ============================================================================

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(
        init,
        payer = user,
        space = Pool::LEN,
        seeds = [b"pool", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    
    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    
    #[account(
        mut,
        constraint = user_token_a.mint == pool.token_a_mint,
        constraint = user_token_a.owner == user.key()
    )]
    pub user_token_a: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_b.mint == pool.token_b_mint,
        constraint = user_token_b.owner == user.key()
    )]
    pub user_token_b: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = token_a_reserve.mint == pool.token_a_mint
    )]
    pub token_a_reserve: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = token_b_reserve.mint == pool.token_b_mint
    )]
    pub token_b_reserve: Account<'info, TokenAccount>,
    
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ZKSwap<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        constraint = user_token_a.mint == pool.token_a_mint,
        constraint = user_token_a.owner == user.key()
    )]
    pub user_token_a: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_b.mint == pool.token_b_mint,
        constraint = user_token_b.owner == user.key()
    )]
    pub user_token_b: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = token_a_reserve.mint == pool.token_a_mint
    )]
    pub token_a_reserve: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = token_b_reserve.mint == pool.token_b_mint
    )]
    pub token_b_reserve: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: ZK verifier program - validated in verify_zk_proof
    pub verifier_program: UncheckedAccount<'info>,

    /// CHECK: Verifier state (required by deployed program, not used)
    pub verifier_state: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ZKSwapReverse<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        constraint = user_token_a.mint == pool.token_a_mint,
        constraint = user_token_a.owner == user.key()
    )]
    pub user_token_a: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_b.mint == pool.token_b_mint,
        constraint = user_token_b.owner == user.key()
    )]
    pub user_token_b: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = token_a_reserve.mint == pool.token_a_mint
    )]
    pub token_a_reserve: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = token_b_reserve.mint == pool.token_b_mint
    )]
    pub token_b_reserve: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: ZK verifier program - validated in verify_zk_proof
    pub verifier_program: UncheckedAccount<'info>,

    /// CHECK: Verifier state (required by deployed program, not used)
    pub verifier_state: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetPoolInfo<'info> {
    pub pool: Account<'info, Pool>,
}

// ============================================================================
// State
// ============================================================================

#[account]
pub struct Pool {
    /// Token A mint address
    pub token_a_mint: Pubkey,
    /// Token B mint address
    pub token_b_mint: Pubkey,
    /// Current reserve of token A
    pub token_a_reserve: u64,
    /// Current reserve of token B
    pub token_b_reserve: u64,
    /// Constant product K (for reference)
    pub k: u128,
    /// PDA bump seed
    pub bump: u8,
    /// Pool authority (creator)
    pub authority: Pubkey,
    /// Total fees collected in token A
    pub total_fees_a: u64,
    /// Total fees collected in token B
    pub total_fees_b: u64,
}

impl Pool {
    pub const LEN: usize = 8    // discriminator
        + 32  // token_a_mint
        + 32  // token_b_mint
        + 8   // token_a_reserve
        + 8   // token_b_reserve
        + 16  // k
        + 1   // bump
        + 32  // authority
        + 8   // total_fees_a
        + 8;  // total_fees_b
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PoolInfo {
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_reserve: u64,
    pub token_b_reserve: u64,
    pub k: u128,
    pub total_fees_a: u64,
    pub total_fees_b: u64,
}

// ============================================================================
// Errors
// ============================================================================

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

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_amount_out_basic() {
        // 1000 in, 10000 reserve in, 10000 reserve out
        // Expected: ~906.61 (with 0.3% fee)
        let result = get_amount_out(1_000_000_000, 10_000_000_000, 10_000_000_000).unwrap();
        assert!(result > 900_000_000 && result < 1_000_000_000);
    }

    #[test]
    fn test_get_amount_out_small() {
        // Small swap should have minimal price impact
        let result = get_amount_out(1_000, 10_000_000_000, 10_000_000_000).unwrap();
        // With 0.3% fee, should be about 997
        assert_eq!(result, 996);
    }

    #[test]
    fn test_get_amount_out_zero_fails() {
        let result = get_amount_out(0, 10_000, 10_000);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_amount_out_empty_reserve_fails() {
        let result = get_amount_out(1_000, 0, 10_000);
        assert!(result.is_err());
        
        let result = get_amount_out(1_000, 10_000, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_fee() {
        // 1000 tokens -> 3 fee (0.3%)
        let fee = calculate_fee(1_000).unwrap();
        assert_eq!(fee, 3);

        // 1_000_000 tokens -> 3000 fee (0.3%)
        let fee = calculate_fee(1_000_000).unwrap();
        assert_eq!(fee, 3000);

        // 1 token -> 0 fee (rounds down)
        let fee = calculate_fee(1).unwrap();
        assert_eq!(fee, 0);
    }

    #[test]
    fn test_constant_product_maintained() {
        let reserve_a: u64 = 10_000_000_000;
        let reserve_b: u64 = 10_000_000_000;
        let amount_in: u64 = 1_000_000_000;

        let amount_out = get_amount_out(amount_in, reserve_a, reserve_b).unwrap();

        // New reserves after swap
        let new_reserve_a = reserve_a + amount_in;
        let new_reserve_b = reserve_b - amount_out;

        // K should increase slightly due to fees
        let old_k = (reserve_a as u128) * (reserve_b as u128);
        let new_k = (new_reserve_a as u128) * (new_reserve_b as u128);

        assert!(new_k >= old_k, "K should not decrease");
    }

    #[test]
    fn test_price_impact_increases_with_size() {
        let reserve = 10_000_000_000u64;
        
        // Small swap
        let small_out = get_amount_out(100_000_000, reserve, reserve).unwrap();
        let small_rate = small_out as f64 / 100_000_000.0;

        // Large swap
        let large_out = get_amount_out(5_000_000_000, reserve, reserve).unwrap();
        let large_rate = large_out as f64 / 5_000_000_000.0;

        // Larger swaps should have worse rates (more slippage)
        assert!(large_rate < small_rate, "Larger swaps should have worse rates");
    }
}
