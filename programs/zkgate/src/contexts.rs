use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::Pool;
use crate::state::shielded::{ShieldedPool, ShieldedRootHistory, Nullifier};

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
    #[account(mut, constraint = user_token_a.mint == pool.token_a_mint, constraint = user_token_a.owner == user.key())]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut, constraint = user_token_b.mint == pool.token_b_mint, constraint = user_token_b.owner == user.key())]
    pub user_token_b: Account<'info, TokenAccount>,
    #[account(mut, constraint = token_a_reserve.mint == pool.token_a_mint)]
    pub token_a_reserve: Account<'info, TokenAccount>,
    #[account(mut, constraint = token_b_reserve.mint == pool.token_b_mint)]
    pub token_b_reserve: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ZKSwap<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(mut, constraint = user_token_a.mint == pool.token_a_mint, constraint = user_token_a.owner == user.key())]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut, constraint = user_token_b.mint == pool.token_b_mint, constraint = user_token_b.owner == user.key())]
    pub user_token_b: Account<'info, TokenAccount>,
    #[account(mut, constraint = token_a_reserve.mint == pool.token_a_mint)]
    pub token_a_reserve: Account<'info, TokenAccount>,
    #[account(mut, constraint = token_b_reserve.mint == pool.token_b_mint)]
    pub token_b_reserve: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: validated in verify_zk_proof
    pub verifier_program: UncheckedAccount<'info>,
    /// CHECK: required by deployed program
    pub verifier_state: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub history: Box<Account<'info, crate::state::roots::StateRootHistory>>,
}

#[derive(Accounts)]
pub struct ZKSwapReverse<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(mut, constraint = user_token_a.mint == pool.token_a_mint, constraint = user_token_a.owner == user.key())]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut, constraint = user_token_b.mint == pool.token_b_mint, constraint = user_token_b.owner == user.key())]
    pub user_token_b: Account<'info, TokenAccount>,
    #[account(mut, constraint = token_a_reserve.mint == pool.token_a_mint)]
    pub token_a_reserve: Account<'info, TokenAccount>,
    #[account(mut, constraint = token_b_reserve.mint == pool.token_b_mint)]
    pub token_b_reserve: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: validated in verify_zk_proof
    pub verifier_program: UncheckedAccount<'info>,
    /// CHECK: required by deployed program
    pub verifier_state: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub history: Box<Account<'info, crate::state::roots::StateRootHistory>>,
}

#[derive(Accounts)]
pub struct GetPoolInfo<'info> {
    pub pool: Account<'info, Pool>,
}

// -----------------------------------------------------------------------------
// shielded swap context
// -----------------------------------------------------------------------------

#[derive(Accounts)]
pub struct SwapPrivate<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub input_shielded_pool: Account<'info, ShieldedPool>,
    #[account(mut)]
    pub input_root_history: AccountLoader<'info, ShieldedRootHistory>,
    // remaining accounts:
    // 0: shielded_vault_in (writable)
    // 1: reserve_in (writable)
    // 2: reserve_out (writable)
    // 3: recipient_token (writable)
    /// CHECK: validated by cpi verifier and public inputs
    pub verifier_program: UncheckedAccount<'info>,
    /// CHECK: pda derived from input shielded pool and nullifier hash
    #[account(mut)]
    pub nullifier_account: UncheckedAccount<'info>,
    #[account(mut)]
    pub relayer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// -----------------------------------------------------------------------------
// shielded pool contexts
// -----------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeShieldedPool<'info> {
    #[account(
        init,
        payer = authority,
        space = ShieldedPool::LEN,
        seeds = [b"shielded_pool", mint.key().as_ref()],
        bump
    )]
    pub shielded_pool: Account<'info, ShieldedPool>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = shielded_pool
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct InitializeShieldedRootHistory<'info> {
    #[account(mut)]
    pub shielded_pool: Account<'info, ShieldedPool>,
    #[account(
        init,
        payer = authority,
        space = ShieldedRootHistory::LEN,
        seeds = [b"shielded_root", shielded_pool.key().as_ref()],
        bump
    )]
    pub root_history: AccountLoader<'info, ShieldedRootHistory>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositShielded<'info> {
    #[account(mut)]
    pub shielded_pool: Account<'info, ShieldedPool>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateShieldedRoot<'info> {
    #[account(mut)]
    pub shielded_pool: Account<'info, ShieldedPool>,
    #[account(mut)]
    pub root_history: AccountLoader<'info, ShieldedRootHistory>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawShielded<'info> {
    #[account(mut)]
    pub shielded_pool: Account<'info, ShieldedPool>,
    #[account(mut)]
    pub root_history: AccountLoader<'info, ShieldedRootHistory>,
    // remaining accounts:
    // 0: vault (writable)
    // 1: recipient_token (writable)
    /// CHECK: validated by cpi verifier and public inputs
    pub verifier_program: UncheckedAccount<'info>,
    /// CHECK: pda derived from shielded pool and nullifier hash
    #[account(mut)]
    pub nullifier_account: UncheckedAccount<'info>,
    #[account(mut)]
    pub relayer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
