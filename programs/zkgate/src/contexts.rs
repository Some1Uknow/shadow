use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::Pool;

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
    /// CHECK: Validated in verify_zk_proof
    pub verifier_program: UncheckedAccount<'info>,
    /// CHECK: Required by deployed program
    pub verifier_state: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
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
    /// CHECK: Validated in verify_zk_proof
    pub verifier_program: UncheckedAccount<'info>,
    /// CHECK: Required by deployed program
    pub verifier_state: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetPoolInfo<'info> {
    pub pool: Account<'info, Pool>,
}
