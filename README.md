# ZKGate DEX

**The first DEX on Solana where you prove you're eligible to trade — without exposing your wallet balance.**

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

### The "KYC Paradox"

Regulated DeFi pools need to verify users (accredited investors, KYC'd users, whitelist members). But current solutions require you to **prove eligibility by exposing your data**.

> "To join this whale pool, show us you have $100,000+"
> 
> *Now everyone knows you have $100,000+*

---

## Our Solution: Prove Without Revealing

Shadow uses **zero-knowledge proofs** to verify eligibility without exposing sensitive data.

```
Traditional:  "I have $147,832.51" → Access granted (but now everyone knows)

ZKGate:       "I can prove I have ≥ $100,000" → Access granted (actual balance stays private)
```

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   1. You enter swap amount (e.g., 100 tokens)                  │
│                          ↓                                      │
│   2. ZK circuit proves: "balance ≥ 100" (without revealing it) │
│                          ↓                                      │
│   3. Proof verified ON-CHAIN via Groth16                       │
│                          ↓                                      │
│   4. Swap executes — you proved eligibility, not your balance  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Real-World Use Cases

### 1. Accredited Investor Pools
Prove you meet the $1M net worth threshold without revealing your exact wealth.

### 2. Whale-Only Trading
Access exclusive liquidity pools by proving you hold 10,000+ tokens — without showing your full stack.

### 3. KYC-Compliant DeFi
Prove your identity is verified without sharing documents or personal data on-chain.

### 4. DAO Governance
Prove you hold enough tokens to vote without revealing your voting power to influence others.

### 5. Whitelist Verification
Prove you're on the presale list without exposing which wallet address you used.

---

## Technical Innovation

### First Noir → Solana Pipeline

We built the first working integration of:

| Component | Technology | What It Does |
|-----------|------------|--------------|
| **ZK Circuits** | [Noir](https://noir-lang.org) | Write proofs in a simple language |
| **Proof System** | Groth16 via [Sunspot](https://github.com/reilabs/sunspot) | Convert to Solana-compatible format |
| **On-chain Verifier** | gnark-verifier | Verify proofs in ~470k compute units |
| **Smart Contract** | Anchor | Execute swaps after verification |

### The ZK Proof

Our Noir circuit (`min_balance`) proves:

```noir
fn main(
    balance: Field,      // Private: your actual balance (hidden)
    threshold: pub Field // Public: minimum required (visible)
) {
    assert(balance >= threshold);  // Prove without revealing
}
```

**What the verifier sees:** "This user has at least X tokens" ✓  
**What the verifier doesn't see:** The actual balance

---

## Live Demo

**[View a real ZK-verified swap on Solana Explorer →](https://explorer.solana.com/tx/4XRjkS2WtHC6UQAiWSRtsLxkg73j8dyS4ChEUGUUgm8tWsNHEQ5cNGPbfjRQ6BacacicRTmqmCWi6CGxLv1qsuPt?cluster=devnet)**

Transaction logs show:
```
✅ ZK proof verified successfully!
🔄 Transferring 3000000000 Token A from User to Pool
🔄 Payout: Transferring 1383657033 Token B to User
✅ Swap executed successfully
```

---

## Quick Start

```bash
git clone https://github.com/your-repo/zkgate-dex
cd zkgate-dex
npm install
cd app && pnpm install
pnpm dev
```

**Full setup guide:** [GUIDE.md](GUIDE.md)

---

## Architecture

```
shadow/
├── circuits/min_balance/    # Noir ZK circuit
├── programs/zkgate/         # Solana program (Anchor)
├── app/                     # Next.js frontend
│   └── src/app/api/prove/   # Proof generation API
└── scripts/                 # Deployment tools
```

---

## Deployed Contracts (Devnet)

| Contract | Address |
|----------|---------|
| Shadow DEX | `GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d` |
| ZK Verifier | `95uEYS5q8LnrfgxAGbZwYn5gbSfsbmRPKiibF5a9P2Qz` |

---

## What's Next

- [ ] Multiple eligibility criteria (balance + time held + etc.)
- [ ] Credential proofs (KYC status, accreditation)
- [ ] Cross-program composability
- [ ] Mainnet deployment

---

## FAQ

**Q: Is the swap itself private?**  
A: No. The swap transaction is visible on-chain like any Solana transaction. What's private is the *eligibility check* — you prove you qualify without revealing your exact balance.

**Q: Why not full transaction privacy?**  
A: True transaction privacy on Solana requires technology (FHE, MPC) that isn't production-ready yet. We built what's possible today: private eligibility verification.

**Q: How is this different from just checking balance on-chain?**  
A: On-chain balance checks expose your exact holdings to everyone. ZK proofs let you prove "I have enough" without revealing "I have exactly X."

---

## Built With

- [Noir](https://noir-lang.org) - ZK circuit language
- [Sunspot](https://github.com/reilabs/sunspot) - Noir → Solana toolchain
- [Anchor](https://anchor-lang.com) - Solana framework
- [Next.js](https://nextjs.org) - Frontend

---

## License

MIT

---

**Built for the future of compliant, privacy-preserving DeFi.**
