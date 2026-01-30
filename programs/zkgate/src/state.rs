use anchor_lang::prelude::*;

pub mod roots;
pub mod shielded;

#[account]
pub struct Pool {
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_reserve: u64,
    pub token_b_reserve: u64,
    pub k: u128,
    pub bump: u8,
    pub authority: Pubkey,
    pub total_fees_a: u64,
    pub total_fees_b: u64,
}

impl Pool {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 16 + 1 + 32 + 8 + 8;
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
