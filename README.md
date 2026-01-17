# Shadow DEX

**Swap on Solana without exposing your eligibility data.**

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Devnet-brightgreen)](https://explorer.solana.com/tx/2ufhPj4hxNcMo8FcxQSuzFDvDvuQDVQD36kHkDSimdPMbxGaBah3NgWkSSzLX1KNerwYTxkZDUM4UDr2P4k2bA8h?cluster=devnet)
[![Built with Noir](https://img.shields.io/badge/ZK-Noir%20%2B%20Groth16-orange)](https://noir-lang.org)
[![Solana](https://img.shields.io/badge/Solana-Devnet-blueviolet)](https://solana.com)

---

## The Problem

DeFi pools often need to verify users before letting them trade:

- "Do you have enough balance?"
- "Do you hold our governance token?"
- "Are you on a sanctions list?"

Today, answering these questions means **exposing your data**. Want to join a whale pool? Show your balance. Want to prove you're not sanctioned? Reveal your wallet address.

## Our Solution

Shadow lets you **prove eligibility without revealing the underlying data**.

```
Traditional: "I have $147,832" → Pool says OK (but now everyone knows your balance)

Shadow:      "I have ≥ $100,000" → Pool says OK (actual balance stays private)
```

We built three types of proofs:

| Proof | What You Prove | What Stays Private |
|-------|----------------|-------------------|
| **Min Balance** | "I have ≥ X tokens" | Your actual balance |
| **Token Holder** | "I hold ≥ Y of token Z" | Your holdings & wallet |
| **Not Blacklisted** | "I'm not on this list" | Your wallet address |

---

## How It Works

1. You enter a swap amount
2. App checks if you meet pool requirements
3. You click "Swap"
4. ZK proofs generate automatically
5. Proofs verify on-chain, swap executes

No manual proof generation. No extra steps. Just swap.

---

## Technical Details

### The Stack

```
Noir Circuits → Sunspot (Groth16) → Solana Verifier → Anchor Program
```

- **[Noir](https://noir-lang.org)** - Write ZK circuits in a simple language
- **[Sunspot](https://github.com/reilabs/sunspot)** - Compile to Solana-compatible Groth16 proofs
- **On-chain Verifier** - Verify proofs in ~470k compute units
- **Anchor** - Execute swaps after verification

### The Circuits

**Min Balance** - Proves `balance ≥ threshold`
```noir
fn main(balance: Field, threshold: pub Field) {
    assert(balance >= threshold);
}
```

**Token Holder** - Proves ownership of specific token ≥ minimum
```noir
fn main(
    token_amount: Field,       // private
    user_address: Field,       // private
    token_mint: pub Field,     // public
    min_required: pub Field    // public
) {
    assert(token_amount >= min_required);
}
```

**Blacklist Exclusion** - Proves address is NOT in a Sparse Merkle Tree
```noir
fn main(
    address: Field,                     // private
    path_indices: [u1; 32],             // private
    sibling_path: pub [Field; 32],      // public
    root: pub Field                     // public
) {
    // Proves the leaf at address's position is empty
    // Empty leaf = address not in tree = not blacklisted
}
```

### Project Structure

```
shadow/
├── circuits/
│   ├── min_balance/        # Balance threshold proofs
│   ├── token_holder/       # Token ownership proofs
│   └── smt_exclusion/      # Blacklist exclusion proofs
├── programs/zkgate/        # Solana program
├── app/                    # Next.js frontend
│   └── src/app/api/prove/  # Proof generation APIs
└── scripts/                # Deployment tools
```

---

## Quick Start

```bash
git clone https://github.com/some1uknow/shadow
cd shadow-dex
npm install

# Compile circuits
cd circuits/min_balance && nargo compile && cd ..
cd token_holder && nargo compile && cd ..
cd smt_exclusion && nargo compile && cd ../..

# Run frontend
cd app && npm install && npm run dev
```

See [GUIDE.md](GUIDE.md) for full setup.

---

## Deployed on Devnet

| Contract | Address |
|----------|---------|
| Shadow DEX | `GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d` |
| ZK Verifier | `95uEYS5q8LnrfgxAGbZwYn5gbSfsbmRPKiibF5a9P2Qz` |

---

## What's Next

- [ ] Credential proofs (KYC status without revealing identity)
- [ ] Time-locked proofs (held tokens for X days)
- [ ] Light Protocol integration
- [ ] Mainnet

---

## License

[MIT](LICENSE)
