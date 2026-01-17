use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use crate::state::Pool;
use crate::errors::ErrorCode;
use crate::math::{get_amount_out, calculate_fee, verify_zk_proof};

#[derive(Clone, Copy, PartialEq)]
pub enum SwapDirection {
    AToB,
    BToA,
}

pub fn execute_swap<'info>(
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
    let (reserve_in_amount, reserve_out_amount) = match direction {
        SwapDirection::AToB => (pool.token_a_reserve, pool.token_b_reserve),
        SwapDirection::BToA => (pool.token_b_reserve, pool.token_a_reserve),
    };

    let amount_out = get_amount_out(amount_in, reserve_in_amount, reserve_out_amount)?;
    require!(amount_out >= min_out, ErrorCode::SlippageExceeded);

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

    let seeds = &[
        b"pool".as_ref(),
        pool.token_a_mint.as_ref(),
        pool.token_b_mint.as_ref(),
        &[pool.bump],
    ];
    let signer_seeds = &[&seeds[..]];

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

    let fee = calculate_fee(amount_in)?;

    match direction {
        SwapDirection::AToB => {
            pool.token_a_reserve = pool.token_a_reserve.checked_add(amount_in).ok_or(ErrorCode::MathOverflow)?;
            pool.token_b_reserve = pool.token_b_reserve.checked_sub(amount_out).ok_or(ErrorCode::MathOverflow)?;
            pool.total_fees_a = pool.total_fees_a.checked_add(fee).ok_or(ErrorCode::MathOverflow)?;
        }
        SwapDirection::BToA => {
            pool.token_b_reserve = pool.token_b_reserve.checked_add(amount_in).ok_or(ErrorCode::MathOverflow)?;
            pool.token_a_reserve = pool.token_a_reserve.checked_sub(amount_out).ok_or(ErrorCode::MathOverflow)?;
            pool.total_fees_b = pool.total_fees_b.checked_add(fee).ok_or(ErrorCode::MathOverflow)?;
        }
    }

    Ok(amount_out)
}

pub fn zk_swap<'info>(
    pool: &mut Account<'info, Pool>,
    token_program: &Program<'info, Token>,
    user_token_a: AccountInfo<'info>,
    user_token_b: AccountInfo<'info>,
    token_a_reserve: AccountInfo<'info>,
    token_b_reserve: AccountInfo<'info>,
    user: &Signer<'info>,
    verifier_program: &AccountInfo<'info>,
    amount_in: u64,
    min_out: u64,
    proof: &[u8],
    public_inputs: &[u8],
) -> Result<()> {
    verify_zk_proof(verifier_program, proof, public_inputs)?;

    let amount_out = execute_swap(
        pool,
        token_program,
        user_token_a,
        user_token_b,
        token_a_reserve,
        token_b_reserve,
        user,
        amount_in,
        min_out,
        SwapDirection::AToB,
    )?;

    msg!("Swap: {} A -> {} B", amount_in, amount_out);
    Ok(())
}

pub fn zk_swap_reverse<'info>(
    pool: &mut Account<'info, Pool>,
    token_program: &Program<'info, Token>,
    user_token_a: AccountInfo<'info>,
    user_token_b: AccountInfo<'info>,
    token_a_reserve: AccountInfo<'info>,
    token_b_reserve: AccountInfo<'info>,
    user: &Signer<'info>,
    verifier_program: &AccountInfo<'info>,
    amount_in: u64,
    min_out: u64,
    proof: &[u8],
    public_inputs: &[u8],
) -> Result<()> {
    verify_zk_proof(verifier_program, proof, public_inputs)?;

    let amount_out = execute_swap(
        pool,
        token_program,
        user_token_b,
        user_token_a,
        token_b_reserve,
        token_a_reserve,
        user,
        amount_in,
        min_out,
        SwapDirection::BToA,
    )?;

    msg!("Swap: {} B -> {} A", amount_in, amount_out);
    Ok(())
}
