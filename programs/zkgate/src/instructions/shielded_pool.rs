use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, program_pack::Pack, system_instruction};
use anchor_spl::token::{self, Transfer};
use anchor_spl::token::spl_token;

use crate::errors::ErrorCode;
use crate::math::{get_amount_out, verify_zk_proof};
use crate::state::Pool;
use crate::state::shielded::{DepositEvent, Nullifier, ROOT_HISTORY_BYTES};

const PUBLIC_INPUTS_LEN: usize = 6; // root, nullifier, amount, recipient, mint, pool

fn parse_field(public_inputs: &[u8], index: usize) -> Result<[u8; 32]> {
    // noir public witness files include a 12-byte header, strip it if present
    let header = if public_inputs.len() == PUBLIC_INPUTS_LEN * 32 + 12 { 12 } else { 0 };
    let start = header + index * 32;
    let end = start + 32;
    if public_inputs.len() < end {
        return Err(ErrorCode::InvalidProof.into());
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&public_inputs[start..end]);
    Ok(out)
}

fn field_to_u64(field_bytes: &[u8; 32]) -> Result<u64> {
    // public witness entries are big-endian, u64 is in the last 8 bytes
    if field_bytes[..24].iter().any(|b| *b != 0) {
        return Err(ErrorCode::InvalidProof.into());
    }
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&field_bytes[24..]);
    Ok(u64::from_be_bytes(buf))
}

fn pubkey_to_field_bytes(key: &Pubkey) -> [u8; 32] {
    let bytes = key.to_bytes();
    let mut out = [0u8; 32];
    // address fields are big-endian 128-bit values in the last 16 bytes
    out[16..].copy_from_slice(&bytes[..16]);
    out
}

fn parse_token_account(account: &AccountInfo) -> Result<spl_token::state::Account> {
    let data = account.try_borrow_data()?;
    spl_token::state::Account::unpack(&data).map_err(|_| ErrorCode::InvalidShieldedAccount.into())
}

fn ensure_nullifier_account<'info>(
    nullifier_info: &AccountInfo<'info>,
    payer_info: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    pool_key: &Pubkey,
    nullifier_hash: &[u8; 32],
) -> Result<()> {
    let (expected_pda, bump) = Pubkey::find_program_address(
        &[b"nullifier", pool_key.as_ref(), nullifier_hash],
        &crate::ID,
    );

    require!(nullifier_info.key() == expected_pda, ErrorCode::InvalidProof);

    if nullifier_info.owner == &crate::ID {
        let mut data = nullifier_info.try_borrow_mut_data()?;
        if data.len() < Nullifier::LEN {
            return Err(ErrorCode::InvalidProof.into());
        }
        let mut cursor: &[u8] = &data;
        let mut nullifier = Nullifier::try_deserialize(&mut cursor)?;
        if nullifier.spent {
            return Err(ErrorCode::NullifierAlreadySpent.into());
        }
        nullifier.spent = true;
        nullifier.serialize(&mut &mut data[..])?;
        return Ok(());
    }

    if nullifier_info.owner != &system_program::ID {
        return Err(ErrorCode::InvalidShieldedAccount.into());
    }

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(Nullifier::LEN);
    let ix = system_instruction::create_account(
        payer_info.key,
        &expected_pda,
        lamports,
        Nullifier::LEN as u64,
        &crate::ID,
    );
    invoke_signed(
        &ix,
        &[payer_info.clone(), nullifier_info.clone(), system_program.clone()],
        &[&[b"nullifier", pool_key.as_ref(), nullifier_hash, &[bump]]],
    )?;

    let mut data = nullifier_info.try_borrow_mut_data()?;
    let nullifier = Nullifier { spent: true };
    nullifier.serialize(&mut &mut data[..])?;
    Ok(())
}

pub fn initialize_shielded_pool(ctx: Context<crate::contexts::InitializeShieldedPool>) -> Result<()> {
    let pool = &mut ctx.accounts.shielded_pool;
    pool.mint = ctx.accounts.mint.key();
    pool.vault = ctx.accounts.vault.key();
    pool.authority = ctx.accounts.authority.key();
    pool.current_root = [0u8; 32];
    let (root_history, _) = Pubkey::find_program_address(
        &[b"shielded_root", pool.key().as_ref()],
        &crate::ID,
    );
    pool.root_history = root_history;
    pool.next_index = 0;
    pool.bump = ctx.bumps.shielded_pool;
    Ok(())
}

pub fn initialize_shielded_root_history(
    ctx: Context<crate::contexts::InitializeShieldedRootHistory>,
) -> Result<()> {
    let pool = &mut ctx.accounts.shielded_pool;
    let mut history = ctx.accounts.root_history.load_init()?;

    require!(pool.authority == ctx.accounts.authority.key(), ErrorCode::InvalidShieldedAccount);
    require!(pool.root_history == ctx.accounts.root_history.key(), ErrorCode::InvalidShieldedAccount);

    history.roots = [0u8; ROOT_HISTORY_BYTES];
    history.current_index = 0;
    history.pool = pool.key();
    Ok(())
}

pub fn deposit_shielded(
    ctx: Context<crate::contexts::DepositShielded>,
    amount: u64,
    commitment: [u8; 32],
) -> Result<()> {
    let pool = &mut ctx.accounts.shielded_pool;
    require!(ctx.accounts.vault.key() == pool.vault, ErrorCode::InvalidShieldedAccount);
    require!(ctx.accounts.vault.mint == pool.mint, ErrorCode::InvalidShieldedAccount);
    require!(ctx.accounts.user_token.mint == pool.mint, ErrorCode::InvalidShieldedAccount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    let index = pool.next_index;
    pool.next_index = pool.next_index.checked_add(1).ok_or(ErrorCode::MathOverflow)?;

    emit!(DepositEvent {
        pool: ctx.accounts.shielded_pool.key(),
        index,
        commitment,
        amount,
    });

    Ok(())
}

pub fn update_shielded_root(
    ctx: Context<crate::contexts::UpdateShieldedRoot>,
    new_root: [u8; 32],
    included_leaves: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.shielded_pool;
    let mut history = ctx.accounts.root_history.load_mut()?;
    require!(pool.authority == ctx.accounts.authority.key(), ErrorCode::InvalidShieldedAccount);
    require!(pool.root_history == ctx.accounts.root_history.key(), ErrorCode::InvalidShieldedAccount);
    require!(history.pool == pool.key(), ErrorCode::InvalidShieldedAccount);
    require!(included_leaves == pool.next_index, ErrorCode::InvalidStateRoot);
    pool.current_root = new_root;
    history.append_root(new_root);
    Ok(())
}

pub fn withdraw_shielded<'info>(
    ctx: Context<'_, '_, '_, 'info, crate::contexts::WithdrawShielded<'info>>,
    amount: u64,
    nullifier_hash: [u8; 32],
    proof: Vec<u8>,
    public_inputs: Vec<u8>,
) -> Result<()> {
    if public_inputs.len() < PUBLIC_INPUTS_LEN * 32 {
        return Err(ErrorCode::InvalidProof.into());
    }
    require!(ctx.remaining_accounts.len() >= 2, ErrorCode::InvalidShieldedAccount);
    let vault_info = ctx.remaining_accounts[0].clone();
    let recipient_info = ctx.remaining_accounts[1].clone();

    verify_zk_proof(&ctx.accounts.verifier_program, &proof, &public_inputs)?;

    let root_bytes = parse_field(&public_inputs, 0)?;
    let nullifier_hash_bytes = parse_field(&public_inputs, 1)?;
    let amount_field = parse_field(&public_inputs, 2)?;
    let recipient_field = parse_field(&public_inputs, 3)?;
    let mint_field = parse_field(&public_inputs, 4)?;
    let pool_field = parse_field(&public_inputs, 5)?;

    let pool = &ctx.accounts.shielded_pool;
    let history = ctx.accounts.root_history.load()?;
    require!(vault_info.key() == pool.vault, ErrorCode::InvalidShieldedAccount);

    let vault_account = parse_token_account(&vault_info)?;
    let recipient_account = parse_token_account(&recipient_info)?;
    require!(vault_account.mint == pool.mint, ErrorCode::InvalidShieldedAccount);
    require!(recipient_account.mint == pool.mint, ErrorCode::InvalidShieldedAccount);
    require!(pool.root_history == ctx.accounts.root_history.key(), ErrorCode::InvalidShieldedAccount);
    require!(history.pool == pool.key(), ErrorCode::InvalidShieldedAccount);

    require!(history.contains_root(&root_bytes), ErrorCode::InvalidStateRoot);
    require!(nullifier_hash_bytes == nullifier_hash, ErrorCode::InvalidProof);

    let proof_amount = field_to_u64(&amount_field)?;
    require!(proof_amount == amount, ErrorCode::InvalidProof);

    let expected_recipient = pubkey_to_field_bytes(&recipient_info.key());
    require!(recipient_field == expected_recipient, ErrorCode::InvalidProof);

    let expected_mint = pubkey_to_field_bytes(&pool.mint);
    require!(mint_field == expected_mint, ErrorCode::InvalidProof);

    let expected_pool = pubkey_to_field_bytes(&ctx.accounts.shielded_pool.key());
    require!(pool_field == expected_pool, ErrorCode::InvalidProof);

    let seeds = &[
        b"shielded_pool".as_ref(),
        pool.mint.as_ref(),
        &[pool.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: vault_info.clone(),
                to: recipient_info.clone(),
                authority: ctx.accounts.shielded_pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    ensure_nullifier_account(
        &ctx.accounts.nullifier_account.to_account_info(),
        &ctx.accounts.relayer.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &ctx.accounts.shielded_pool.key(),
        &nullifier_hash,
    )?;

    Ok(())
}

// -----------------------------------------------------------------------------
// shielded swap, uses shielded deposits as private input
// -----------------------------------------------------------------------------

pub fn swap_private<'info>(
    ctx: Context<'_, '_, '_, 'info, crate::contexts::SwapPrivate<'info>>,
    proof: Vec<u8>,
    public_inputs: Vec<u8>,
    amount_in: u64,
    min_out: u64,
    is_a_to_b: bool,
    nullifier_hash: [u8; 32],
) -> Result<()> {
    if public_inputs.len() < PUBLIC_INPUTS_LEN * 32 {
        return Err(ErrorCode::InvalidProof.into());
    }
    require!(ctx.remaining_accounts.len() >= 4, ErrorCode::InvalidShieldedAccount);
    let shielded_vault_info = ctx.remaining_accounts[0].clone();
    let reserve_in_info = ctx.remaining_accounts[1].clone();
    let reserve_out_info = ctx.remaining_accounts[2].clone();
    let recipient_info = ctx.remaining_accounts[3].clone();

    // 1) verify zk proof for note ownership
    verify_zk_proof(&ctx.accounts.verifier_program, &proof, &public_inputs)?;

    let root_bytes = parse_field(&public_inputs, 0)?;
    let nullifier_hash_bytes = parse_field(&public_inputs, 1)?;
    let amount_field = parse_field(&public_inputs, 2)?;
    let recipient_field = parse_field(&public_inputs, 3)?;
    let mint_field = parse_field(&public_inputs, 4)?;
    let pool_field = parse_field(&public_inputs, 5)?;

    let pool = &mut ctx.accounts.pool;

    let expected_pool = pubkey_to_field_bytes(&ctx.accounts.input_shielded_pool.key());
    require!(pool_field == expected_pool, ErrorCode::InvalidProof);

    let proof_amount = field_to_u64(&amount_field)?;
    require!(proof_amount == amount_in, ErrorCode::InvalidProof);
    require!(nullifier_hash_bytes == nullifier_hash, ErrorCode::InvalidProof);

    let recipient_key = recipient_info.key();
    let expected_recipient = pubkey_to_field_bytes(&recipient_key);
    require!(recipient_field == expected_recipient, ErrorCode::InvalidProof);

    let expected_mint_in = if is_a_to_b {
        pubkey_to_field_bytes(&pool.token_a_mint)
    } else {
        pubkey_to_field_bytes(&pool.token_b_mint)
    };
    require!(mint_field == expected_mint_in, ErrorCode::InvalidProof);

    let reserve_in_account = parse_token_account(&reserve_in_info)?;
    let reserve_out_account = parse_token_account(&reserve_out_info)?;
    let recipient_account = parse_token_account(&recipient_info)?;
    let reserve_in_mint = reserve_in_account.mint;
    let reserve_out_mint = reserve_out_account.mint;
    let expected_in_mint = if is_a_to_b { pool.token_a_mint } else { pool.token_b_mint };
    let expected_out_mint = if is_a_to_b { pool.token_b_mint } else { pool.token_a_mint };
    let input_pool = &ctx.accounts.input_shielded_pool;
    let input_history = ctx.accounts.input_root_history.load()?;
    require!(input_pool.mint == expected_in_mint, ErrorCode::InvalidProof);
    require!(shielded_vault_info.key() == input_pool.vault, ErrorCode::InvalidProof);
    let shielded_vault_account = parse_token_account(&shielded_vault_info)?;
    require!(shielded_vault_account.mint == input_pool.mint, ErrorCode::InvalidProof);
    require!(recipient_account.mint == expected_out_mint, ErrorCode::InvalidProof);
    require!(input_pool.root_history == ctx.accounts.input_root_history.key(), ErrorCode::InvalidProof);
    require!(input_history.pool == input_pool.key(), ErrorCode::InvalidProof);
    require!(reserve_in_mint == expected_in_mint, ErrorCode::InvalidProof);
    require!(reserve_out_mint == expected_out_mint, ErrorCode::InvalidProof);

    require!(input_history.contains_root(&root_bytes), ErrorCode::InvalidStateRoot);

    ensure_nullifier_account(
        &ctx.accounts.nullifier_account.to_account_info(),
        &ctx.accounts.relayer.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &ctx.accounts.input_shielded_pool.key(),
        &nullifier_hash,
    )?;

    // 2) move amount_in from shielded vault to amm reserve
    let input_vault_seeds = &[
        b"shielded_pool".as_ref(),
        input_pool.mint.as_ref(),
        &[input_pool.bump],
    ];
    let input_vault_signer = &[&input_vault_seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: shielded_vault_info.clone(),
                to: reserve_in_info.clone(),
                authority: ctx.accounts.input_shielded_pool.to_account_info(),
            },
            input_vault_signer,
        ),
        amount_in,
    )?;

    // 3) execute amm swap and send output to recipient
    let (reserve_in_amount, reserve_out_amount) = if is_a_to_b {
        (pool.token_a_reserve, pool.token_b_reserve)
    } else {
        (pool.token_b_reserve, pool.token_a_reserve)
    };

    let amount_out = get_amount_out(amount_in, reserve_in_amount, reserve_out_amount)?;
    require!(amount_out >= min_out, ErrorCode::SlippageExceeded);

    let pool_seeds = &[
        b"pool".as_ref(),
        pool.token_a_mint.as_ref(),
        pool.token_b_mint.as_ref(),
        &[pool.bump],
    ];
    let pool_signer = &[&pool_seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: reserve_out_info.clone(),
                to: recipient_info.clone(),
                authority: pool.to_account_info(),
            },
            pool_signer,
        ),
        amount_out,
    )?;

    // update amm reserves
    if is_a_to_b {
        pool.token_a_reserve = pool.token_a_reserve.checked_add(amount_in).ok_or(ErrorCode::MathOverflow)?;
        pool.token_b_reserve = pool.token_b_reserve.checked_sub(amount_out).ok_or(ErrorCode::MathOverflow)?;
    } else {
        pool.token_b_reserve = pool.token_b_reserve.checked_add(amount_in).ok_or(ErrorCode::MathOverflow)?;
        pool.token_a_reserve = pool.token_a_reserve.checked_sub(amount_out).ok_or(ErrorCode::MathOverflow)?;
    }

    msg!("Shielded swap executed. Out: {}", amount_out);
    Ok(())
}
