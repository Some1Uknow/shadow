use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

pub mod errors;
pub mod state;
pub mod math;
pub mod contexts;
pub mod instructions;

use errors::ErrorCode;
use state::PoolInfo;
use state::roots::StateRootHistory;
use contexts::*;
use instructions::swap;
use instructions::shielded_pool::*;

declare_id!("3TKv2Y8SaxJd2wmmtBS58GjET4mLz5esMZjnGfrstG72");

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
        
        // 1. Verify that the State Root used in the proof is valid
        let claimed_root: [u8; 32] = public_inputs[0..32].try_into().map_err(|_| ErrorCode::InvalidProof)?;
        require!(ctx.accounts.history.contains(&claimed_root), ErrorCode::InvalidStateRoot);

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
        
        // 1. Verify that the State Root used in the proof is valid
        let claimed_root: [u8; 32] = public_inputs[0..32].try_into().map_err(|_| ErrorCode::InvalidProof)?;
        require!(ctx.accounts.history.contains(&claimed_root), ErrorCode::InvalidStateRoot);

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

    pub fn deposit(ctx: Context<DepositShielded>, amount: u64, commitment: [u8; 32]) -> Result<()> {
        instructions::shielded_pool::deposit_shielded(ctx, amount, commitment)
    }

    pub fn swap_private<'info>(
        ctx: Context<'_, '_, '_, 'info, SwapPrivate<'info>>,
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
        amount_in: u64,
        min_out: u64,
        is_a_to_b: bool,
        nullifier_hash: [u8; 32],
    ) -> Result<()> {
        instructions::shielded_pool::swap_private(ctx, proof, public_inputs, amount_in, min_out, is_a_to_b, nullifier_hash)
    }

    pub fn initialize_shielded_pool(ctx: Context<InitializeShieldedPool>) -> Result<()> {
        instructions::shielded_pool::initialize_shielded_pool(ctx)
    }

    pub fn initialize_shielded_root_history(ctx: Context<InitializeShieldedRootHistory>) -> Result<()> {
        instructions::shielded_pool::initialize_shielded_root_history(ctx)
    }

    pub fn update_shielded_root(
        ctx: Context<UpdateShieldedRoot>,
        new_root: [u8; 32],
        included_leaves: u64,
    ) -> Result<()> {
        instructions::shielded_pool::update_shielded_root(ctx, new_root, included_leaves)
    }

    pub fn withdraw_shielded<'info>(
        ctx: Context<'_, '_, '_, 'info, WithdrawShielded<'info>>,
        amount: u64,
        nullifier_hash: [u8; 32],
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
    ) -> Result<()> {
        instructions::shielded_pool::withdraw_shielded(ctx, amount, nullifier_hash, proof, public_inputs)
    }

    pub fn update_roots(ctx: Context<UpdateRoots>, new_root: [u8; 32]) -> Result<()> {
        let history = &mut ctx.accounts.history;
        history.append(new_root);
        msg!("Root appended: {:?}", new_root);
        Ok(())
    }

    pub fn initialize_history(ctx: Context<InitializeHistory>) -> Result<()> {
        let history = &mut ctx.accounts.history;
        history.authority = ctx.accounts.authority.key();
        history.current_index = 0;
        msg!("State Root History Initialized");
        Ok(())
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

#[derive(Accounts)]
pub struct UpdateRoots<'info> {
    #[account(mut, has_one = authority)]
    pub history: Box<Account<'info, StateRootHistory>>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeHistory<'info> {
    #[account(
        init, 
        payer = authority, 
        space = StateRootHistory::LEN
    )]
    pub history: Box<Account<'info, StateRootHistory>>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
