# Shadow DEX

**ZK Gated swaps on Solana.**  
Hackathon project with real proofs and real devnet swaps.

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Devnet-brightgreen)](https://explorer.solana.com/tx/4AeG6yqyqfRhJzBy2apTcCrVEDsEwqgHWsc8uFvdaKnseuYB8SjWC83KidujaELqe6sqGTUhdkK4eCzgNWWnbv3W?cluster=devnet)
[![Built with Noir](https://img.shields.io/badge/Built%20with-Noir-orange)](https://noir-lang.org)
[![Solana](https://img.shields.io/badge/Solana-Devnet-blueviolet)](https://solana.com)

---

## The Problem

DeFi pools often need to verify users before letting them trade:

- "Do you have enough balance?"
- "Do you hold our governance token?"
- "Are you on a sanctions list?"

Today, answering these questions usually means exposing your data. Want to join a whale pool? Show your balance. Want to prove you are not sanctioned? Reveal your wallet address.

## What Shadow Does

Shadow lets you prove eligibility without revealing the underlying data.  
Swaps still execute on Solana, so amounts and recipients are on chain, but your eligibility data and shielded note ownership stay private.

```
Traditional: "I have $147,832" → Pool says OK (but now everyone knows your balance)

Shadow:      "I have ≥ $100,000" → Pool says OK (actual balance stays private)
```

We support four proof types:

| Proof | What You Prove | What Stays Private | Where It Is Checked |
|-------|----------------|-------------------|---------------------|
| **Min Balance** | "I have ≥ X tokens" | Your exact balance | Relayer |
| **Token Holder** | "I hold ≥ Y of token Z" | Your holdings and wallet | Relayer |
| **Not Blacklisted** | "I'm not on this list" | Your wallet address | Relayer (simplified demo) |
| **Shielded Spend** | "I own a note in the shielded pool" | Which deposit note you spent | On chain |

> **Try it:** Use the **Proof Mode Selector** in the swap interface to test each proof type.

### What is private today

- **Private**: your eligibility data, and which shielded note you spend.
- **Visible on chain**: token mints, amounts, pool, and swap outputs.

This is honest privacy for a hackathon demo. It hides who can trade and why, but not the amounts.

### Why we chose this

Everyone is chasing full on-chain privacy. We took a different path that is practical today.  
We focused on eligibility privacy plus real swaps, so teams can gate access without exposing user data.

---

## How It Works

1. Pick a proof mode and swap amount
2. The app creates a shielded deposit note
3. A proof is generated in the background
4. A relayer submits the swap using your proof
5. The program verifies the shielded proof and executes the swap

No manual proof steps. Just swap.

### Swap flow diagrams

Shielded mode swap flow:

![Shielded Swap Flow](app/public/shieldedpool.png)

All proofs mode swap flow:

![All Proofs Swap Flow](app/public/allproofswap.png)

### What changes between shielded mode and all proofs mode

- **On chain**: both modes call the same `SwapPrivate` instruction and verify the same shielded spend proof. You can see this in the transaction logs.
- **Off chain**: in all proofs mode, the relayer verifies three extra proofs before it submits the swap.
  - Min balance
  - Token holder
  - Not blacklisted (demo version)
- Those extra checks do not appear on chain because they are relayer side today.

### A note on proof generation

Proofs are generated on the server today because Sunspot is easiest to run there.  
This is a demo tradeoff, not a design requirement, and can move client side when tooling improves.

### Demo notes

- Shielded spend proofs are verified on chain, and eligibility proofs are verified by the relayer.
- Min balance and token holder proofs are bound to real SPL token account data, but do not yet verify against a global Solana state root.
- Blacklist exclusion is still simplified in this demo.
- Root updates require a configured root authority key. The app uses it to keep the on-chain root history in sync with the local tree.
We are aware of these gaps and are actively working through the next steps below.

---

## Tech Stack (Simple)

- **Noir** for writing the proof rules
- **Sunspot** for compiling proofs for Solana
- **Solana programs** to verify proofs and execute swaps
- **Next.js app** for the UI and proof API

### Project Structure

```
shadow/
├── circuits/
│   ├── min_balance/        # Balance threshold proofs ✅
│   ├── token_holder/       # Token ownership proofs ✅
│   ├── smt_exclusion/      # Blacklist exclusion proofs ✅
│   └── shielded_spend/     # Shielded pool spend proofs ✅
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

See [GUIDE.md](GUIDE.md) for full setup and deployment instructions.

---

## Deployed on Devnet

| Contract | Address |
|----------|---------|
| Shadow DEX | [`3TKv2Y8SaxJd2wmmtBS58GjET4mLz5esMZjnGfrstG72`](https://explorer.solana.com/address/3TKv2Y8SaxJd2wmmtBS58GjET4mLz5esMZjnGfrstG72?cluster=devnet) |
| Shielded Verifier | [`HPsMCiGGMEScQdKxihvSazYyXPsyXi7fj5q2vtBfQ4tF`](https://explorer.solana.com/address/HPsMCiGGMEScQdKxihvSazYyXPsyXi7fj5q2vtBfQ4tF?cluster=devnet) |
| Token A | `7YfeuJcTLunbJLd58BLHdYww7g4P6aCtFdZM38f1NqgY` |
| Token B | `7VxpQBGHGxbPXmmbW22mZfxdD9ULuhghuK8A68ZB7Hid` |

**Example Transactions:**  
- Shielded mode swap: https://explorer.solana.com/tx/4r1hKt9mwC5pAXx9c1gqZU8LASjaeQyCNftZHAwjHBT83j9NpViyWXK5Vjw3Q8JewpcWuKSCsyF29Nc3sqJ4H8k6?cluster=devnet  
- All proofs mode swap: https://explorer.solana.com/tx/wVPTC7saKwFHVniCPjJAEiTVaY35yYkkNEj5C8oB3uZWSSQ8o96FdQpCmQkViRFKRNd4tgRfdZJoSPs2q9HHVqq?cluster=devnet

---

## Testing

### Testing All Proof Modes (For Judges)

The swap interface includes a **Proof Mode Selector** that lets you test each proof type:

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
   - Proofs are generated for the selected mode and checked before swap executes

---

## What's Next

- **Durable pool service**: move the local tree to a persistent service that keeps pool roots in sync and exposes simple APIs.
- **Shielded outputs**: create new notes for recipients so amounts and recipients are not visible on chain.
- **Stronger privacy by default**: batch deposits, add delays, and route through multiple relayers to reduce timing clues.
- **Production hardening**: safer key handling, rate limits, monitoring, audits, and reproducible builds.

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
