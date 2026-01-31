# Shadow DEX - Setup Guide

Get the ZK-verified DEX running on Solana devnet.

**Time:** ~15 minutes

---

## Prerequisites

### Required Tools

```bash
# 1. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 2. Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 3. Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.0
avm use 0.30.0

# 4. Node.js 18+ & pnpm
npm install -g pnpm

# 5. Noir (nargo)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash
noirup -v 1.0.0-beta.18

# 6. Go (for Sunspot)
# Mac: brew install go
# Linux: sudo apt install golang-go
```

### Sunspot Setup

```bash
git clone https://github.com/reilabs/sunspot.git ~/sunspot
cd ~/sunspot/go
go build -o sunspot .
sudo mv sunspot /usr/local/bin/
```

---

## Quick Start (Use Our Deployment)

If you just want to test without deploying:

```bash
git clone <repo> shadow
cd shadow
npm install

# Setup environment for tests (optional)
cp .env.example .env

# Setup frontend
cd app && pnpm install
cp .env.local.example .env.local
pnpm dev
```

Open http://localhost:3000

**Note:** You still need `nargo` and `sunspot` installed for proof generation.

---

## Full Deployment

### 1. Setup Wallet

```bash
solana config set --url devnet
solana-keygen new --outfile deployer.json --no-bip39-passphrase
solana airdrop 2 $(solana-keygen pubkey deployer.json) --url devnet
```

### 2. Compile ZK Circuits

```bash
cd circuits/min_balance && nargo compile && nargo test && cd ../..
cd circuits/token_holder && nargo compile && cd ../..
cd circuits/smt_exclusion && nargo compile && cd ../..
cd circuits/shielded_spend && nargo compile && cd ../..
```

### 3. Generate & Deploy Verifier

```bash
sunspot compile circuits/min_balance/target/min_balance.json
sunspot setup circuits/min_balance/target/min_balance.ccs
sunspot build-verifier circuits/min_balance/target/min_balance.vk

solana program deploy \
  circuits/min_balance/target/verifier.so \
  --url devnet \
  --keypair deployer.json \
  --program-id circuits/min_balance/target/verifier-keypair.json
```

Save the **Verifier Program ID**.

### 3b. Generate & Deploy Verifier (Shielded Spend)

```bash
sunspot compile circuits/shielded_spend/target/shielded_spend.json
sunspot setup circuits/shielded_spend/target/shielded_spend.ccs
sunspot deploy circuits/shielded_spend/target/shielded_spend.vk

solana program deploy \
  circuits/shielded_spend/target/shielded_spend.so \
  --url devnet \
  --keypair deployer.json \
  --program-id circuits/shielded_spend/target/shielded_spend-keypair.json
```

Save the **Shielded Verifier Program ID**.

### 4. Deploy DEX Program

```bash
anchor build
anchor deploy --provider.cluster devnet --provider.wallet deployer.json
```

Save the **DEX Program ID**.

### 5. Initialize Pool

```bash
npx ts-node scripts/create-pool.ts
npx ts-node scripts/init-pool.ts
npx ts-node scripts/add-liquidity.ts
```

### 5b. Update Shielded Roots (Sequencer)

After deposits, the shielded pool root must be updated by the authority:

```bash
npx ts-node scripts/update-shielded-root.ts <shieldedPoolPubkey> <root> <includedLeaves>
```

**Note:** Root updates must be signed by the **shielded pool authority** (the deployer by default).
If you run the frontend, set:

```
ROOT_AUTHORITY_PRIVATE_KEY=<json secret key>  # optional; defaults to deployer.json
```

### 6. Configure Frontend

Update `app/.env.local` with your deployed addresses:

```
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=<dex-program-id>
NEXT_PUBLIC_VERIFIER_PROGRAM_ID=<verifier-program-id>
NEXT_PUBLIC_SHIELDED_POOL_A=<shielded-pool-a>
NEXT_PUBLIC_SHIELDED_POOL_B=<shielded-pool-b>
NEXT_PUBLIC_SHIELDED_VAULT_A=<shielded-vault-a>
NEXT_PUBLIC_SHIELDED_VAULT_B=<shielded-vault-b>
NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_A=<shielded-root-history-a>
NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_B=<shielded-root-history-b>
NEXT_PUBLIC_SHIELDED_VERIFIER_PROGRAM_ID=<shielded-verifier-program-id>
# ... other addresses from pool-config.json
```

### 7. Run

```bash
cd app
pnpm dev
```

---

## Get Test Tokens

```bash
npx ts-node scripts/airdrop-tokens.ts YOUR_WALLET_ADDRESS
```

---

## Deployed Contracts (Devnet)

| Contract | Address |
|----------|---------|
| DEX Program | `3TKv2Y8SaxJd2wmmtBS58GjET4mLz5esMZjnGfrstG72` |
| Shielded Verifier | `6uKeW1P2VQL9TqTkohKAJ1uJMNYxw7yhPFxy9Yjo42uu` |
| Token A | `7YfeuJcTLunbJLd58BLHdYww7g4P6aCtFdZM38f1NqgY` |
| Token B | `7VxpQBGHGxbPXmmbW22mZfxdD9ULuhghuK8A68ZB7Hid` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Airdrop failed | Wait 1-2 min, try again or use faucet.solana.com |
| Program not found | Check `.env.local` matches deployed addresses |
| Proof generation failed | Ensure `nargo` and `sunspot` are in PATH |
| Build errors | `rm -rf node_modules .next && pnpm install` |

---

## How It Works

1. **Generate Proof** - Noir circuit proves `balance ≥ amount` without revealing balance
2. **Verify On-Chain** - Groth16 proof verified by deployed verifier (~200k–400k CU)
3. **Execute Swap** - AMM swap executes after proof verification

The ZK proof ensures you're eligible to trade without exposing your actual holdings.

Amounts and recipients remain public on Solana; eligibility data and shielded note ownership stay private.

---

## Project Structure

```
shadow/
├── circuits/min_balance/    # Noir ZK circuit
├── programs/zkgate/         # Solana program (Anchor)
├── app/                     # Next.js frontend
│   └── src/app/api/prove/   # Proof generation API
└── scripts/                 # Deployment tools
```

---

## Links

- [Live Demo TX](https://explorer.solana.com/tx/4AeG6yqyqfRhJzBy2apTcCrVEDsEwqgHWsc8uFvdaKnseuYB8SjWC83KidujaELqe6sqGTUhdkK4eCzgNWWnbv3W?cluster=devnet)
- [Noir Lang](https://noir-lang.org)
- [Sunspot](https://github.com/reilabs/sunspot)
