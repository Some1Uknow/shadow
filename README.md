# Shadow DEX

**The first DEX on Solana where you prove you're eligible to trade — without exposing your wallet, holdings, or identity.**

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Devnet-brightgreen)](https://explorer.solana.com/tx/4XRjkS2WtHC6UQAiWSRtsLxkg73j8dyS4ChEUGUUgm8tWsNHEQ5cNGPbfjRQ6BacacicRTmqmCWi6CGxLv1qsuPt?cluster=devnet)
[![Built with Noir](https://img.shields.io/badge/ZK-Noir%20%2B%20Groth16-orange)](https://noir-lang.org)
[![Solana](https://img.shields.io/badge/Solana-Devnet-blueviolet)](https://solana.com)

---

## The Problem We Solve

### Today's DeFi exposes too much

When you interact with a DEX, everyone can see:
- ✗ Your exact wallet balance
- ✗ Your trading history
- ✗ Your position sizes
- ✗ When you're about to make a big trade

This creates real problems:

| Problem | Impact |
|---------|--------|
| **Front-running** | Bots see your pending trade and jump ahead |
| **Whale tracking** | Your large holdings make you a target |
| **Copy trading** | Competitors mirror your strategy |
| **Social engineering** | Scammers know exactly how much you have |

### The "Compliance Paradox"

Regulated DeFi pools need to verify users meet certain criteria:
- Accredited investors with minimum holdings
- Token holders for governance participation  
- Clean wallets not on sanctions lists

But current solutions require you to **prove eligibility by exposing your data**.

> "To join this whale pool, show us you have $100,000+"
> 
> *Now everyone knows you have $100,000+*

> "To prove you're not sanctioned, reveal your wallet address"
>
> *Now your identity is linked to all your transactions*

---

## Our Solution: Prove Without Revealing

Shadow uses **zero-knowledge proofs** to verify eligibility without exposing sensitive data.

```
Traditional:  "I have $147,832.51" → Access granted (but now everyone knows)

Shadow:       "I can prove I have ≥ $100,000" → Access granted (actual balance stays private)
```

### Three Proof Types for Complete Privacy

| Proof Type | What It Proves | What Stays Private |
|------------|----------------|-------------------|
| **Min Balance** | You have ≥ X tokens | Your actual balance |
| **Token Holder** | You hold ≥ Y of a specific token | Your holdings & wallet address |
| **Blacklist Exclusion** | You're NOT on a sanctions list | Your identity & wallet address |

---

## 🆕 New: Multi-Circuit ZK Verification

### Automatic Proof Enforcement

Unlike other ZK implementations that require manual proof generation, Shadow **automatically enforces** pool requirements:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   1. User enters swap amount                                    │
│                          ↓                                      │
│   2. App checks pool requirements automatically                 │
│      • Min balance? ✓                                          │
│      • Token holder? ✓                                         │
│      • Not blacklisted? ✓                                      │
│                          ↓                                      │
│   3. User clicks "Swap" — proofs generate seamlessly           │
│                          ↓                                      │
│   4. On-chain verification via Groth16                         │
│                          ↓                                      │
│   5. Swap executes — eligibility proven, privacy preserved     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**No manual "Generate Proof" buttons. No confusing circuit selection. Just swap.**

---

## The Three Circuits

### 1. Min Balance (`min_balance`)

**Problem:** Pools want to ensure users have sufficient funds, but checking on-chain exposes exact balances.

**Solution:** Prove `balance ≥ threshold` without revealing the actual balance.

```noir
fn main(
    balance: Field,        // PRIVATE: your actual balance
    threshold: pub Field   // PUBLIC: minimum required
) {
    assert(balance >= threshold);
}
```

**Use Cases:**
- Whale-only pools (prove you hold 10,000+ tokens)
- Accredited investor verification ($1M+ net worth)
- Tiered fee structures based on holdings

---

### 2. Token Holder (`token_holder`)

**Problem:** Token-gated features require proving ownership of specific tokens, but this links your wallet to your identity.

**Solution:** Prove you hold ≥ X of a specific token without revealing your wallet address or exact holdings.

```noir
fn main(
    token_amount: Field,      // PRIVATE: your token balance
    user_address: Field,      // PRIVATE: your wallet address
    token_mint: pub Field,    // PUBLIC: which token
    min_required: pub Field   // PUBLIC: minimum amount
) {
    assert(token_amount >= min_required);
}
```

**Use Cases:**
- DAO governance (prove voting power without revealing it)
- NFT holder benefits (prove ownership without doxxing wallet)
- Loyalty programs (prove you hold project tokens)
- Airdrop eligibility (prove holdings at snapshot)

---

### 3. Blacklist Exclusion (`smt_exclusion`)

**Problem:** Compliance requires checking users aren't on sanctions lists (OFAC, etc.), but this requires revealing wallet addresses to centralized services.

**Solution:** Prove your address is NOT on a blacklist using a Sparse Merkle Tree non-membership proof — without revealing which address you're proving for.

```noir
fn main(
    address: Field,                        // PRIVATE: your wallet address
    path_indices: [u1; 32],                // PRIVATE: merkle path directions
    sibling_path: pub [Field; 32],         // PUBLIC: merkle siblings
    root: pub Field                        // PUBLIC: blacklist merkle root
) {
    // Proves the address's slot in the tree is EMPTY
    // Therefore, address is NOT in the blacklist
}
```

**How SMT Exclusion Works:**

```
Blacklist Tree (Sparse Merkle Tree)
─────────────────────────────────────
Every possible address has a "slot" in the tree.
• If address is blacklisted → slot contains address hash
• If address is clean → slot is EMPTY (zero)

To prove you're NOT blacklisted:
1. Show the merkle path to your address's slot
2. Prove that slot is EMPTY
3. Verifier confirms path is valid for the known root

Result: Proof that you're not on the list, without revealing who you are.
```

**Use Cases:**
- OFAC/sanctions compliance for DeFi
- Anti-sybil verification
- Clean wallet verification for institutional pools
- KYC-compliant DeFi without exposing identity

---

## Real-World Use Cases

### 1. Compliant Institutional Pool
```
Requirements:
  ✓ Min balance: 100,000 USDC
  ✓ Token holder: 1,000 GOV tokens
  ✓ Not on OFAC list

User proves all three with ZK proofs.
Institution knows user is compliant.
Institution doesn't know user's identity or exact holdings.
```

### 2. DAO Governance
```
Requirement: Hold 10,000+ GOV tokens to vote

Traditional: Everyone sees your voting power → vote buying, coercion
Shadow: Prove you can vote without revealing your influence
```

### 3. Whale-Only Trading
```
Requirement: Hold $1M+ to access deep liquidity

Traditional: Prove wealth by exposing wallet → become a target
Shadow: Prove you qualify without painting a target on your back
```

### 4. Airdrop Claims
```
Requirement: Held 1,000+ tokens at snapshot block

Traditional: Link claim wallet to historical wallet → full history exposed
Shadow: Prove eligibility without linking wallets
```

---

## Technical Architecture

### The ZK Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Noir      │     │   Sunspot    │     │   Groth16    │     │   Solana     │
│   Circuits   │ ──▶ │   Compiler   │ ──▶ │    Prover    │ ──▶ │   Verifier   │
│  (3 types)   │     │              │     │              │     │  (on-chain)  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

| Component | Technology | Purpose |
|-----------|------------|---------|
| **ZK Circuits** | [Noir](https://noir-lang.org) | Define what to prove |
| **Proof System** | Groth16 via [Sunspot](https://github.com/reilabs/sunspot) | Generate Solana-compatible proofs |
| **On-chain Verifier** | gnark-verifier | Verify proofs in ~470k compute units |
| **Smart Contract** | Anchor | Execute swaps after verification |
| **Frontend** | Next.js + React | Seamless UX with automatic proofs |

### Project Structure

```
shadow/
├── circuits/
│   ├── min_balance/       # Balance threshold proofs
│   ├── token_holder/      # Specific token ownership proofs
│   └── smt_exclusion/     # Blacklist non-membership proofs
├── programs/
│   └── zkgate/            # Solana program (Anchor)
├── app/
│   ├── src/
│   │   ├── app/api/prove/ # Proof generation APIs
│   │   │   ├── route.ts           # min_balance
│   │   │   ├── token-holder/      # token_holder
│   │   │   └── exclusion/         # smt_exclusion
│   │   ├── hooks/
│   │   │   ├── useZKProof.ts      # Multi-circuit proof hook
│   │   │   └── usePoolRequirements.ts  # Auto-enforcement
│   │   └── components/
│   │       └── SwapInterfaceV2.tsx    # Seamless swap UI
└── scripts/               # Deployment tools
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Rust & Cargo
- [Noir](https://noir-lang.org/docs/getting_started/installation) (nargo)
- [Sunspot](https://github.com/reilabs/sunspot) (for Groth16 proofs)
- Solana CLI

### Installation

```bash
# Clone the repo
git clone https://github.com/your-repo/shadow-dex
cd shadow-dex

# Install dependencies
npm install
cd app && npm install

# Compile circuits
cd ../circuits/min_balance && nargo compile
cd ../token_holder && nargo compile
cd ../smt_exclusion && nargo compile

# Start the app
cd ../../app
npm run dev
```

**Full setup guide:** [GUIDE.md](GUIDE.md)

---

## Deployed Contracts (Devnet)

| Contract | Address |
|----------|---------|
| Shadow DEX | `GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d` |
| ZK Verifier | `95uEYS5q8LnrfgxAGbZwYn5gbSfsbmRPKiibF5a9P2Qz` |

---

## API Endpoints

### `POST /api/prove`
Generate min_balance proof.

```json
{
  "balance": "1000000000",
  "threshold": "500000000"
}
```

### `POST /api/prove/token-holder`
Generate token holder proof.

```json
{
  "token_amount": "10000000000",
  "user_address": "0x...",
  "token_mint": "0x...",
  "min_required": "1000000000"
}
```

### `POST /api/prove/exclusion`
Generate blacklist exclusion proof.

```json
{
  "address": "0x...",
  "path_indices": ["0", "1", "0", ...],
  "sibling_path": ["0x...", "0x...", ...],
  "root": "0x..."
}
```

---

## Pool Requirements Configuration

Pools can require any combination of proofs:

```typescript
// In usePoolRequirements.ts
const requirements = [
  {
    type: 'min_balance',
    enabled: true,
    threshold: 100,  // Must have 100+ tokens
  },
  {
    type: 'token_holder',
    enabled: true,
    tokenMint: 'BONK_MINT_ADDRESS',
    tokenSymbol: 'BONK',
    minRequired: 10000,  // Must hold 10k BONK
  },
  {
    type: 'exclusion',
    enabled: true,
    blacklistRoot: '0x...',  // OFAC list merkle root
    blacklistName: 'OFAC SDN',
  },
];
```

The app automatically:
1. Checks all requirements when user enters swap amount
2. Shows eligibility status (✓ or ✗) in real-time
3. Generates all required proofs when user clicks "Swap"
4. Executes the swap with proofs attached

---

## Roadmap

- [x] Min balance proofs
- [x] Token holder proofs  
- [x] Blacklist exclusion proofs (SMT)
- [x] Automatic proof enforcement
- [x] Multi-requirement pools
- [ ] Credential proofs (KYC status, accreditation)
- [ ] Time-locked proofs (held tokens for X days)
- [ ] Cross-program composability
- [ ] Light Protocol integration for compressed tokens
- [ ] Mainnet deployment

---

## FAQ

**Q: Is the swap itself private?**  
A: The swap transaction is visible on-chain. What's private is the *eligibility verification* — you prove you qualify without revealing your exact balance, holdings, or identity.

**Q: How is the blacklist exclusion proof different from just checking an address?**  
A: Traditional compliance checks require revealing your address to a centralized service. Our SMT exclusion proof lets you prove you're NOT on a list without revealing WHICH address you're proving for.

**Q: Can pools require multiple proofs?**  
A: Yes! Pools can require any combination of min_balance, token_holder, and exclusion proofs. The app handles all of them automatically.

**Q: Do users need to manually generate proofs?**  
A: No. The app automatically checks requirements and generates proofs when the user clicks "Swap". The UX is seamless.

**Q: What if I don't meet the requirements?**  
A: The app shows which requirements aren't met (e.g., "Need 100 tokens, have 50"). You can't proceed until all requirements are satisfied.

---

## Built With

- [Noir](https://noir-lang.org) - ZK circuit language
- [Sunspot](https://github.com/reilabs/sunspot) - Noir → Solana toolchain  
- [Anchor](https://anchor-lang.com) - Solana framework
- [Next.js](https://nextjs.org) - Frontend
- [Light Protocol](https://lightprotocol.com) - Compressed tokens (coming soon)

---

## License

MIT

---

**Built for the future of compliant, privacy-preserving DeFi.**

*Prove eligibility. Preserve privacy. Trade freely.*
