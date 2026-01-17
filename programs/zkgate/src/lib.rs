use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub mod errors;
pub mod state;
pub mod math;
pub mod contexts;
pub mod instructions;

use errors::ErrorCode;
use state::{Pool, PoolInfo};
use contexts::*;
use instructions::swap;

declare_id!("GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d");

#[program]
pub mod zkgate {
    use super::*;

    pub fn create_pool(ctx: Context<CreatePool>, init_a: u64, init_b: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.token_a_mint = ctx.accounts.token_a_mint.key();
        pool.token_b_mint = ctx.accounts.token_b_mint.key();
        pool.token_a_reserve = init_a;
        pool.token_b_reserve = init_b;
        pool.k = (init_a as u128).checked_mul(init_b as u128).ok_or(ErrorCode::MathOverflow)?;
        pool.bump = ctx.bumps.pool;
        pool.authority = ctx.accounts.user.key();
        pool.total_fees_a = 0;
        pool.total_fees_b = 0;
        msg!("Pool created: A={}, B={}", init_a, init_b);
        Ok(())
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount_a: u64, amount_b: u64) -> Result<()> {
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

        let pool = &mut ctx.accounts.pool;
        pool.token_a_reserve = pool.token_a_reserve.checked_add(amount_a).ok_or(ErrorCode::MathOverflow)?;
        pool.token_b_reserve = pool.token_b_reserve.checked_add(amount_b).ok_or(ErrorCode::MathOverflow)?;
        pool.k = (pool.token_a_reserve as u128).checked_mul(pool.token_b_reserve as u128).ok_or(ErrorCode::MathOverflow)?;
        msg!("Liquidity added: A={}, B={}", amount_a, amount_b);
        Ok(())
    }

    pub fn zk_swap(
        ctx: Context<ZKSwap>,
        amount_in: u64,
        min_out: u64,
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
    ) -> Result<()> {
        swap::zk_swap(
            &mut ctx.accounts.pool,
            &ctx.accounts.token_program,
            ctx.accounts.user_token_a.to_account_info(),
            ctx.accounts.user_token_b.to_account_info(),
            ctx.accounts.token_a_reserve.to_account_info(),
            ctx.accounts.token_b_reserve.to_account_info(),
            &ctx.accounts.user,
            &ctx.accounts.verifier_program,
            amount_in,
            min_out,
            &proof,
            &public_inputs,
        )
    }

    pub fn zk_swap_reverse(
        ctx: Context<ZKSwapReverse>,
        amount_in: u64,
        min_out: u64,
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
    ) -> Result<()> {
        swap::zk_swap_reverse(
            &mut ctx.accounts.pool,
            &ctx.accounts.token_program,
            ctx.accounts.user_token_a.to_account_info(),
            ctx.accounts.user_token_b.to_account_info(),
            ctx.accounts.token_a_reserve.to_account_info(),
            ctx.accounts.token_b_reserve.to_account_info(),
            &ctx.accounts.user,
            &ctx.accounts.verifier_program,
            amount_in,
            min_out,
            &proof,
            &public_inputs,
        )
    }

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
