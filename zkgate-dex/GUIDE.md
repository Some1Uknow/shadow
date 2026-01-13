# ZKGate DEX Setup Guide

Complete setup instructions to run ZKGate DEX locally and deploy to Solana devnet.

## Prerequisites

Install these before proceeding:

| Tool | Version | Install Command |
|------|---------|-----------------|
| **Rust** | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Solana CLI** | 1.18+ | `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"` |
| **Anchor CLI** | 0.30+ | `cargo install --git https://github.com/coral-xyz/anchor anchor-cli` |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **pnpm** | 8+ | `npm install -g pnpm` |
| **Noir (nargo)** | 1.0.0-beta.13 | `curl -L noirup.dev \| bash && noirup -v 1.0.0-beta.13` |
| **Go** | 1.24+ | `brew install go` (macOS) |

## 1. Clone & Install Dependencies

```bash
git clone https://github.com/yourusername/zkgate-dex
cd zkgate-dex

# Install Anchor dependencies
npm install

# Install frontend dependencies
cd app && pnpm install && cd ..
```

## 2. Setup Sunspot (ZK Proof Tooling)

Sunspot converts Noir circuits to Groth16 proofs for Solana:

```bash
# Clone and build Sunspot
git clone https://github.com/reilabs/sunspot.git ~/sunspot
cd ~/sunspot/go
go build -o sunspot .
sudo mv sunspot /usr/local/bin/

# Set environment variable (add to ~/.zshrc or ~/.bashrc)
echo 'export GNARK_VERIFIER_BIN="$HOME/sunspot/gnark-solana/crates/verifier-bin"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
sunspot --help
```

## 3. Configure Solana for Devnet

```bash
# Set to devnet
solana config set --url devnet

# Create or use existing wallet
solana-keygen new --outfile deployer.json
# OR use existing: cp ~/.config/solana/id.json deployer.json

# Get devnet SOL (may need to retry due to rate limits)
solana airdrop 5 $(solana-keygen pubkey deployer.json) --url devnet
```

## 4. Compile Noir Circuits

```bash
# Compile the min_balance circuit
cd circuits/min_balance
nargo compile
nargo test  # Should pass all tests

# Return to project root
cd ../..
```

## 5. Setup Sunspot Verifier

```bash
# Compile Noir → Groth16 CCS
sunspot compile circuits/min_balance/target/min_balance.json

# Generate proving and verifying keys
sunspot setup circuits/min_balance/target/min_balance.ccs

# Build verifier Solana program
sunspot deploy circuits/min_balance/target/min_balance.vk

# Deploy verifier to devnet
solana program deploy circuits/min_balance/target/min_balance.so \
  --url devnet \
  --keypair deployer.json \
  --program-id circuits/min_balance/target/min_balance-keypair.json

# Note the Verifier Program ID from output!
```

## 6. Build & Deploy Anchor Program

```bash
# Build the program
anchor build

# Sync program IDs
anchor keys sync

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Note the Program ID from output!
```

## 7. Create Pool & Tokens

```bash
# Install script dependencies
cd scripts && npm install && cd ..

# Create test tokens and pool config
cd scripts && npx ts-node create-pool.ts && cd ..

# Initialize pool on-chain
cd scripts && npx ts-node init-pool.ts && cd ..

# Add liquidity to pool
cd scripts && npx ts-node add-liquidity.ts && cd ..
```

## 8. Configure Frontend

Update `app/.env.local` with your deployed addresses:

```env
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=<your-program-id>
NEXT_PUBLIC_TOKEN_A_MINT=<from-pool-config.json>
NEXT_PUBLIC_TOKEN_B_MINT=<from-pool-config.json>
NEXT_PUBLIC_POOL_PDA=<from-pool-config.json>
NEXT_PUBLIC_TOKEN_A_RESERVE=<from-pool-config.json>
NEXT_PUBLIC_TOKEN_B_RESERVE=<from-pool-config.json>
NEXT_PUBLIC_VERIFIER_PROGRAM_ID=<your-verifier-id>
NEXT_PUBLIC_VERIFIER_STATE=11111111111111111111111111111111
```

Or copy from the generated file:
```bash
cat pool-config.json
```

## 9. Run Frontend

```bash
cd app
pnpm dev
```

Open http://localhost:3000 and connect your wallet (set to Devnet).

## 10. Test a Swap

1. **Get test tokens** — Run `cd scripts && npx ts-node airdrop-tokens.ts <your-wallet-address>`
2. **Enter amount** — e.g., `0.5` Token A
3. **Generate ZK Proof** — Click the button (takes ~5-10 seconds)
4. **Execute Swap** — Signs and sends transaction
5. **View on Explorer** — Check transaction logs for "ZK proof verified successfully!"

## Troubleshooting

### "Airdrop failed"
Devnet rate limits airdrops. Wait a few minutes or use [Solana Faucet](https://faucet.solana.com/).

### "Program does not exist"
Ensure `NEXT_PUBLIC_PROGRAM_ID` matches your deployed program (not the one in README).

### "Exceeded compute units"
The SwapInterface already requests 500k CUs. If still failing, try a smaller swap amount.

### "Insufficient funds"
Run `add-liquidity.ts` to add tokens to the pool reserves.

### "InstructionFallbackNotFound"
Copy the real IDL: `cp target/idl/zkgate.json app/src/idl/zkgate.json`

## Project Scripts

| Script | Purpose |
|--------|---------|
| `create-pool.ts` | Creates test tokens and computes pool addresses |
| `init-pool.ts` | Initializes pool account on-chain |
| `add-liquidity.ts` | Adds tokens to pool reserves |
| `airdrop-tokens.ts` | Sends test tokens to a wallet |

## Deployed Addresses (Example)

These are example addresses from our devnet deployment:

```
DEX Program:      GXJ3CW71zDWP8ejuougsMicsLvZbMr4H1B2n2KvtLuK9
ZK Verifier:      95uEYS5q8LnrfgxAGbZwYn5gbSfsbmRPKiibF5a9P2Qz
```

---

**Need help?** Open an issue or reach out!
