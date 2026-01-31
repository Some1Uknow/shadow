use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::Instruction;
use crate::errors::ErrorCode;

pub const FEE_BPS: u64 = 30;
pub const FEE_DENOMINATOR: u64 = 10000;
const FEE_NUMERATOR: u128 = 997;
const FEE_DENOM: u128 = 1000;

pub fn calculate_fee(amount: u64) -> Result<u64> {
    let fee = (amount as u128)
        .checked_mul(FEE_BPS as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(FEE_DENOMINATOR as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(fee as u64)
}

pub fn get_amount_out(amount_in: u64, reserve_in: u64, reserve_out: u64) -> Result<u64> {
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

pub fn verify_zk_proof<'info>(
    verifier_program: &AccountInfo<'info>,
    proof: &[u8],
    public_inputs: &[u8],
) -> Result<()> {
    let system_program_id = anchor_lang::solana_program::system_program::ID;
    require!(*verifier_program.key != system_program_id, ErrorCode::InvalidVerifier);

    msg!("Verifying ZK proof via CPI to: {}", verifier_program.key);
    msg!("Proof Len: {}, Inputs Len: {}", proof.len(), public_inputs.len());

    // gnark-solana verifier expects instruction data = proof || public_witness
    let mut instruction_data = Vec::with_capacity(proof.len() + public_inputs.len());
    instruction_data.extend_from_slice(proof);         // proof first
    instruction_data.extend_from_slice(public_inputs); // public inputs second

    let ix = Instruction {
        program_id: *verifier_program.key,
        accounts: vec![],
        data: instruction_data,
    };

    invoke(&ix, &[verifier_program.clone()]).map_err(|e| {
        msg!("ZK proof verification failed: {:?}", e);
        ErrorCode::InvalidProof
    })?;

    msg!("ZK proof verified successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_amount_out_basic() {
        let result = get_amount_out(1_000_000_000, 10_000_000_000, 10_000_000_000).unwrap();
        assert!(result > 900_000_000 && result < 1_000_000_000);
    }

    #[test]
    fn test_get_amount_out_small() {
        let result = get_amount_out(1_000, 10_000_000_000, 10_000_000_000).unwrap();
        assert_eq!(result, 996);
    }

    #[test]
    fn test_get_amount_out_zero_fails() {
        let result = get_amount_out(0, 10_000, 10_000);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_amount_out_empty_reserve_fails() {
        assert!(get_amount_out(1_000, 0, 10_000).is_err());
        assert!(get_amount_out(1_000, 10_000, 0).is_err());
    }

    #[test]
    fn test_calculate_fee() {
        assert_eq!(calculate_fee(1_000).unwrap(), 3);
        assert_eq!(calculate_fee(1_000_000).unwrap(), 3000);
        assert_eq!(calculate_fee(1).unwrap(), 0);
    }

    #[test]
    fn test_constant_product_maintained() {
        let reserve_a: u64 = 10_000_000_000;
        let reserve_b: u64 = 10_000_000_000;
        let amount_in: u64 = 1_000_000_000;

        let amount_out = get_amount_out(amount_in, reserve_a, reserve_b).unwrap();
        let new_reserve_a = reserve_a + amount_in;
        let new_reserve_b = reserve_b - amount_out;

        let old_k = (reserve_a as u128) * (reserve_b as u128);
        let new_k = (new_reserve_a as u128) * (new_reserve_b as u128);
        assert!(new_k >= old_k);
    }

    #[test]
    fn test_price_impact_increases_with_size() {
        let reserve = 10_000_000_000u64;
        let small_out = get_amount_out(100_000_000, reserve, reserve).unwrap();
        let large_out = get_amount_out(5_000_000_000, reserve, reserve).unwrap();
        assert!((large_out as f64 / 5_000_000_000.0) < (small_out as f64 / 100_000_000.0));
    }
}
