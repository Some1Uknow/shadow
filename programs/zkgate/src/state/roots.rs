use anchor_lang::prelude::*;

#[account]
pub struct StateRootHistory {
    pub roots: [u8; 3200], // stores last 100 roots (32 bytes each)
    pub current_index: u64,
    pub authority: Pubkey,
}

impl StateRootHistory {
    pub const LEN: usize = 8 + 3200 + 8 + 32;

    pub fn append(&mut self, new_root: [u8; 32]) {
        let idx = (self.current_index as usize) % 100;
        let start = idx * 32;
        let end = start + 32;
        
        self.roots[start..end].copy_from_slice(&new_root);
        self.current_index += 1;
    }

    pub fn contains(&self, root: &[u8; 32]) -> bool {
        for i in 0..100 {
            let start = i * 32;
            let end = start + 32;
            if &self.roots[start..end] == root {
                return true;
            }
        }
        false
    }
}
