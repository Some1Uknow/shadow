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

We built three types of ZK circuits for different privacy use cases:

| Proof | What You Prove | What Stays Private | Status |
|-------|----------------|-------------------|--------|
| **Min Balance** | "I have ≥ X tokens" | Your actual balance | ✅ Fully Integrated |
| **Token Holder** | "I hold ≥ Y of token Z" | Your holdings & wallet | ✅ Fully Integrated |
| **Not Blacklisted** | "I'm not on this list" | Your wallet address | ✅ Fully Integrated |

> **🎮 Try All Proof Modes:** Use the **Proof Mode Selector** in the swap interface to test each circuit type. Switch between modes to see how different ZK proofs protect different types of data.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Shadow DEX Flow                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────────┐     ┌─────────────────────────────┐
│   Frontend   │     │   Proof Server   │     │         Solana              │
│  (Next.js)   │     │   (Next.js API)  │     │                             │
└──────┬───────┘     └────────┬─────────┘     └──────────────┬──────────────┘
       │                      │                              │
       │  1. User enters      │                              │
       │     swap amount      │                              │
       │                      │                              │
       │  2. Check balance    │                              │
       ├─────────────────────►│                              │
       │                      │                              │
       │  3. Generate proof   │                              │
       │     request          │                              │
       ├─────────────────────►│                              │
       │                      │                              │
       │                      │  4. Write Prover.toml        │
       │                      │     (balance, threshold)     │
       │                      │                              │
       │                      │  5. nargo execute            │
       │                      │     → witness.gz             │
       │                      │                              │
       │                      │  6. sunspot prove            │
       │                      │     → Groth16 proof          │
       │                      │                              │
       │  7. Return proof     │                              │
       │◄─────────────────────┤                              │
       │                      │                              │
       │  8. Submit swap tx   │                              │
       │     with proof       │                              │
       ├─────────────────────────────────────────────────────►
       │                      │                              │
       │                      │              9. CPI to       │
       │                      │                 Verifier     │
       │                      │              ┌───────────┐   │
       │                      │              │ Groth16   │   │
       │                      │              │ Verifier  │   │
       │                      │              │ (~470k CU)│   │
       │                      │              └─────┬─────┘   │
       │                      │                    │         │
       │                      │              10. If valid,   │
       │                      │                  execute     │
       │                      │                  AMM swap    │
       │                      │              ┌───────────┐   │
       │                      │              │  ZKGate   │   │
       │                      │              │   DEX     │   │
       │                      │              └───────────┘   │
       │                      │                              │
       │  11. Tx confirmed    │                              │
       │◄─────────────────────────────────────────────────────
       │                      │                              │
       ▼                      ▼                              ▼
```

### Component Details

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 16, React 19, Tailwind | Wallet connection, swap UI, proof status |
| **Proof API** | Next.js API Routes | Uses nargo + sunspot for proof generation |
| **Noir Circuits** | Noir v1.0.0-beta | Define ZK constraints |
| **Sunspot** | Go CLI | Compiles Noir → Solana-compatible Groth16 |
| **Verifier** | Solana Program (BPF) | On-chain Groth16 verification (~470k CU) |
| **ZKGate DEX** | Anchor/Rust | AMM logic, CPI to verifier, token swaps |

---

## How It Works

1. You enter a swap amount
2. App checks if you meet pool requirements
3. You click "Swap"
4. ZK proofs generate automatically (~2-5 seconds)
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

**Min Balance** 
```noir
fn main(balance: Field, threshold: pub Field) {
    assert(balance >= threshold);
}
```

**Token Holder**
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

**Blacklist Exclusion**     
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
│   ├── min_balance/        # Balance threshold proofs ✅
│   ├── token_holder/       # Token ownership proofs 🔧
│   └── smt_exclusion/      # Blacklist exclusion proofs 🔧
├── programs/zkgate/        # Solana program (Anchor)
│   └── src/
│       ├── lib.rs          # Program entrypoint
│       ├── contexts.rs     # Account contexts
│       ├── instructions/   # Swap logic
│       ├── math.rs         # AMM math + ZK verification
│       └── state.rs        # Pool state
├── app/                    # Next.js frontend
│   └── src/
│       ├── app/api/prove/  # Proof generation APIs
│       ├── components/     # React components
│       └── hooks/          # Custom hooks (useProgram, useZKProof, etc.)
├── scripts/                # Deployment & testing tools
└── tests/                  # Anchor integration tests
```

---

## Quick Start

### Prerequisites

- Rust, Solana CLI, Anchor CLI
- Node.js 18+, pnpm
- [Noir](https://noir-lang.org) (nargo v1.0.0-beta.1)
- [Sunspot](https://github.com/reilabs/sunspot)

### Run Locally

```bash
git clone https://github.com/some1uknow/shadow
cd shadow
npm install

# Compile circuits
cd circuits/min_balance && nargo compile && cd ..
cd token_holder && nargo compile && cd ..
cd smt_exclusion && nargo compile && cd ../..

# Run frontend (uses our deployed devnet contracts)
cd app && pnpm install && pnpm dev
```

Open http://localhost:3000

See [GUIDE.md](GUIDE.md) for full deployment instructions.

---

## Deployed on Devnet

| Contract | Address |
|----------|---------|
| Shadow DEX | [`GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d`](https://explorer.solana.com/address/GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d?cluster=devnet) |
| ZK Verifier | [`GtS9r61Tv7s78nR5D61hFczb2Uau1eRVf176xXNAajuD`](https://explorer.solana.com/address/GtS9r61Tv7s78nR5D61hFczb2Uau1eRVf176xXNAajuD?cluster=devnet) |
| Token A | `BzzNnKq1sJfkeUH7iyi823HDwCBSxYBx4s3epbvpvYqk` |
| Token B | `CSxuownDqx9oVqojxAedaSmziKeFPRwFbmaoRCK1hrRc` |

**Example Transaction:** [View on Explorer](https://explorer.solana.com/tx/2ufhPj4hxNcMo8FcxQSuzFDvDvuQDVQD36kHkDSimdPMbxGaBah3NgWkSSzLX1KNerwYTxkZDUM4UDr2P4k2bA8h?cluster=devnet)

---

## Testing

### Testing All Proof Modes (For Judges)

The swap interface includes a **Proof Mode Selector** that lets you test all three ZK circuits:

| Mode | What It Tests | Requirements |
|------|---------------|--------------|
| **💰 Min Balance** | Prove balance ≥ swap amount | Have enough Token A |
| **🏛️ Token Holder** | Prove you hold governance tokens | Have ≥1 Token B + enough Token A |
| **🛡️ Not Blacklisted** | Prove you're not on sanctions list | Have enough Token A |
| **🔐 All Proofs** | All three proofs combined | All of the above |

**To test:**
1. Connect your wallet on devnet
2. Get test tokens using the faucet (or swap to get Token B)
3. Click the **Proof Mode Selector** dropdown
4. Select different modes and observe:
   - Requirements panel shows different checks
   - Proof generation creates different proof types
   - All proofs verify on-chain before swap executes

---

## What's Next

- [x] ~~Multi-proof pools (combine min_balance + token_holder + exclusion)~~ ✅ Done!
- [ ] Time-locked proofs (held tokens for X days)
- [ ] Light Protocol integration for compressed tokens
- [ ] Shielded pools (hide token holder)
- [ ] Mainnet deployment

---

### Circuit Tests

```bash
# Run Noir circuit tests
cd circuits/min_balance && nargo test
cd ../token_holder && nargo test
cd ../smt_exclusion && nargo test
```

### Integration Tests

```bash
# Run Anchor tests (requires .env with ANCHOR_PROVIDER_URL)
cp .env.example .env
anchor test

# Build frontend
cd app && pnpm build
```

---

## License

[MIT](LICENSE)
