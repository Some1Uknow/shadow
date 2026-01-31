use anchor_lang::prelude::*;

/// shielded pool state for a single spl token mint
/// root updates are managed by an off-chain sequencer or relayer authority
#[account]
pub struct ShieldedPool {
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub current_root: [u8; 32],
    pub root_history: Pubkey,
    pub next_index: u64,
    pub bump: u8,
}

impl ShieldedPool {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 8 + 1;
}

/// marks a nullifier as spent
#[account]
pub struct Nullifier {
    pub spent: bool,
}

impl Nullifier {
    pub const LEN: usize = 8 + 1;
}

#[event]
pub struct DepositEvent {
    pub pool: Pubkey,
    pub index: u64,
    pub commitment: [u8; 32],
    pub amount: u64,
}

pub const ROOT_HISTORY_SIZE: usize = 32;
pub const ROOT_HISTORY_BYTES: usize = ROOT_HISTORY_SIZE * 32;

#[account(zero_copy)]
#[repr(C)]
pub struct ShieldedRootHistory {
    pub current_index: u64,
    pub pool: Pubkey,
    pub roots: [u8; ROOT_HISTORY_BYTES],
}

impl ShieldedRootHistory {
    pub const LEN: usize = 8 + 8 + 32 + ROOT_HISTORY_BYTES;

    pub fn append_root(&mut self, new_root: [u8; 32]) {
        let idx = (self.current_index as usize) % ROOT_HISTORY_SIZE;
        let start = idx * 32;
        let end = start + 32;
        self.roots[start..end].copy_from_slice(&new_root);
        self.current_index += 1;
    }

    pub fn contains_root(&self, root: &[u8; 32]) -> bool {
        for i in 0..ROOT_HISTORY_SIZE {
            let start = i * 32;
            let end = start + 32;
            if &self.roots[start..end] == root {
                return true;
            }
        }
        false
    }
}
