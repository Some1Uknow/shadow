# Shadow DEX - Setup Guide

Get the ZK-verified DEX running on Solana devnet.

**Time:** ~15 minutes  
**Difficulty:** Intermediate

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
noirup -v 1.0.0-beta.1

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

### 2. Compile ZK Circuit

```bash
cd circuits/min_balance
nargo compile
nargo test
cd ../..
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

### 6. Configure Frontend

Update `app/.env.local` with your deployed addresses:

```
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=<dex-program-id>
NEXT_PUBLIC_VERIFIER_PROGRAM_ID=<verifier-program-id>
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
| DEX Program | `GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d` |
| ZK Verifier | `95uEYS5q8LnrfgxAGbZwYn5gbSfsbmRPKiibF5a9P2Qz` |
| Token A | `BzzNnKq1sJfkeUH7iyi823HDwCBSxYBx4s3epbvpvYqk` |
| Token B | `CSxuownDqx9oVqojxAedaSmziKeFPRwFbmaoRCK1hrRc` |

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
2. **Verify On-Chain** - Groth16 proof verified by deployed verifier (~470k CU)
3. **Execute Swap** - AMM swap executes after proof verification

The ZK proof ensures you're eligible to trade without exposing your actual holdings.

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

- [Live Demo TX](https://explorer.solana.com/tx/2ufhPj4hxNcMo8FcxQSuzFDvDvuQDVQD36kHkDSimdPMbxGaBah3NgWkSSzLX1KNerwYTxkZDUM4UDr2P4k2bA8h?cluster=devnet)
- [Noir Lang](https://noir-lang.org)
- [Sunspot](https://github.com/reilabs/sunspot)
