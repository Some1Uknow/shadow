# ZKGate DEX - Build & Deploy Commands
# Requires: just (cargo install just), nargo, sunspot, anchor, solana-cli

# Default recipe
default:
    @just --list

# ============================================================================
# Setup
# ============================================================================

# Install all dependencies
install:
    @echo "Installing dependencies..."
    ./scripts/setup.sh

# Setup wallet and devnet
wallet:
    @echo "Setting up wallet..."
    ./scripts/wallet-setup.sh

# ============================================================================
# Noir Circuits
# ============================================================================

# Compile all circuits
compile-all: compile-min_balance compile-token_holder compile-smt_exclusion compile-shielded_spend

# Compile min_balance circuit
compile-min_balance:
    @echo "Compiling min_balance circuit..."
    cd circuits/min_balance && nargo compile

# Compile token_holder circuit
compile-token_holder:
    @echo "Compiling token_holder circuit..."
    cd circuits/token_holder && nargo compile

# Compile smt_exclusion circuit
compile-smt_exclusion:
    @echo "Compiling smt_exclusion circuit..."
    cd circuits/smt_exclusion && nargo compile

# Compile shielded_spend circuit
compile-shielded_spend:
    @echo "Compiling shielded_spend circuit..."
    cd circuits/shielded_spend && nargo compile

# Test all circuits
test-circuits: test-min_balance test-token_holder test-smt_exclusion test-shielded_spend

# Test min_balance circuit
test-min_balance:
    @echo "Testing min_balance circuit..."
    cd circuits/min_balance && nargo test

# Test token_holder circuit
test-token_holder:
    @echo "Testing token_holder circuit..."
    cd circuits/token_holder && nargo test

# Test smt_exclusion circuit
test-smt_exclusion:
    @echo "Testing smt_exclusion circuit..."
    cd circuits/smt_exclusion && nargo test

# Test shielded_spend circuit
test-shielded_spend:
    @echo "Testing shielded_spend circuit..."
    cd circuits/shielded_spend && nargo test

# Copy circuit artifacts to frontend
copy-circuits:
    @echo "Copying circuit artifacts to frontend..."
    mkdir -p app/public
    cp circuits/min_balance/target/min_balance.json app/public/
    cp circuits/token_holder/target/token_holder.json app/public/
    cp circuits/smt_exclusion/target/smt_exclusion.json app/public/
    cp circuits/shielded_spend/target/shielded_spend.json app/public/
    @echo "Circuit artifacts copied to app/public/"

# Generate .env.local from pool-config.json
generate-env:
    @echo "Generating .env.local from pool-config.json..."
    node -e "const c = require('./pool-config.json'); \
      const env = [ \
        'NEXT_PUBLIC_NETWORK=devnet', \
        'NEXT_PUBLIC_PROGRAM_ID=' + c.programId, \
        'NEXT_PUBLIC_TOKEN_A_MINT=' + c.tokenAMint, \
        'NEXT_PUBLIC_TOKEN_B_MINT=' + c.tokenBMint, \
        'NEXT_PUBLIC_POOL_PDA=' + c.poolPda, \
        'NEXT_PUBLIC_TOKEN_A_RESERVE=' + c.poolTokenAReserve, \
        'NEXT_PUBLIC_TOKEN_B_RESERVE=' + c.poolTokenBReserve, \
        'NEXT_PUBLIC_SHIELDED_POOL_A=' + c.shieldedPoolA, \
        'NEXT_PUBLIC_SHIELDED_POOL_B=' + c.shieldedPoolB, \
        'NEXT_PUBLIC_SHIELDED_VAULT_A=' + c.shieldedVaultA, \
        'NEXT_PUBLIC_SHIELDED_VAULT_B=' + c.shieldedVaultB, \
        'NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_A=' + c.shieldedRootHistoryA, \
        'NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_B=' + c.shieldedRootHistoryB, \
        'NEXT_PUBLIC_SHIELDED_VERIFIER_PROGRAM_ID=', \
        'NEXT_PUBLIC_VERIFIER_PROGRAM_ID=', \
        'NEXT_PUBLIC_VERIFIER_STATE=' \
      ].join('\n'); \
      require('fs').writeFileSync('app/.env.local', env); \
      console.log('Created app/.env.local');"

# ============================================================================
# Sunspot (Groth16 Setup & Proving)
# ============================================================================

# Setup proving keys for all circuits
setup-all: setup-min_balance setup-token_holder setup-smt_exclusion setup-shielded_spend

# Setup min_balance proving key
setup-min_balance:
    @echo "Setting up min_balance proving key..."
    mkdir -p keys/min_balance
    sunspot setup circuits/min_balance/target/min_balance.json \
        --pk keys/min_balance/proving_key.pk \
        --vk keys/min_balance/verifying_key.vk

# Setup token_holder proving key
setup-token_holder:
    @echo "Setting up token_holder proving key..."
    mkdir -p keys/token_holder
    sunspot setup circuits/token_holder/target/token_holder.json \
        --pk keys/token_holder/proving_key.pk \
        --vk keys/token_holder/verifying_key.vk

# Setup smt_exclusion proving key
setup-smt_exclusion:
    @echo "Setting up smt_exclusion proving key..."
    mkdir -p keys/smt_exclusion
    sunspot setup circuits/smt_exclusion/target/smt_exclusion.json \
        --pk keys/smt_exclusion/proving_key.pk \
        --vk keys/smt_exclusion/verifying_key.vk

# Setup shielded_spend proving key
setup-shielded_spend:
    @echo "Setting up shielded_spend proving key..."
    mkdir -p keys/shielded_spend
    sunspot setup circuits/shielded_spend/target/shielded_spend.json \
        --pk keys/shielded_spend/proving_key.pk \
        --vk keys/shielded_spend/verifying_key.vk

# Generate proof for min_balance
prove-min_balance:
    @echo "Generating min_balance proof..."
    sunspot prove \
        --circuit circuits/min_balance/target/min_balance.json \
        --pk keys/min_balance/proving_key.pk \
        --inputs circuits/min_balance/Prover.toml \
        --proof keys/min_balance/proof.bin

# Generate proof for token_holder
prove-token_holder:
    @echo "Generating token_holder proof..."
    sunspot prove \
        --circuit circuits/token_holder/target/token_holder.json \
        --pk keys/token_holder/proving_key.pk \
        --inputs circuits/token_holder/Prover.toml \
        --proof keys/token_holder/proof.bin

# Generate proof for smt_exclusion
prove-smt_exclusion:
    @echo "Generating smt_exclusion proof..."
    sunspot prove \
        --circuit circuits/smt_exclusion/target/smt_exclusion.json \
        --pk keys/smt_exclusion/proving_key.pk \
        --inputs circuits/smt_exclusion/Prover.toml \
        --proof keys/smt_exclusion/proof.bin

# Verify proof locally
verify-min_balance:
    @echo "Verifying min_balance proof..."
    sunspot verify \
        --vk keys/min_balance/verifying_key.vk \
        --proof keys/min_balance/proof.bin

# Verify token_holder proof locally
verify-token_holder:
    @echo "Verifying token_holder proof..."
    sunspot verify \
        --vk keys/token_holder/verifying_key.vk \
        --proof keys/token_holder/proof.bin

# Verify smt_exclusion proof locally
verify-smt_exclusion:
    @echo "Verifying smt_exclusion proof..."
    sunspot verify \
        --vk keys/smt_exclusion/verifying_key.vk \
        --proof keys/smt_exclusion/proof.bin

# ============================================================================
# Verifier Deployment
# ============================================================================

# Deploy min_balance verifier to devnet
deploy-verifier-min_balance:
    @echo "Deploying min_balance verifier..."
    sunspot deploy keys/min_balance/verifying_key.vk $GNARK_VERIFIER_BIN
    solana program deploy target/deploy/verifier.so --keypair deployer.json

# Deploy token_holder verifier to devnet
deploy-verifier-token_holder:
    @echo "Deploying token_holder verifier..."
    sunspot deploy keys/token_holder/verifying_key.vk $GNARK_VERIFIER_BIN
    solana program deploy target/deploy/verifier.so --keypair deployer.json

# ============================================================================
# Anchor Program
# ============================================================================

# Build Anchor program
build:
    @echo "Building Anchor program..."
    anchor build

# Test Anchor program (local validator)
test:
    @echo "Testing Anchor program..."
    anchor test

# Deploy to devnet
deploy:
    @echo "Deploying to devnet..."
    anchor deploy --provider.cluster devnet

# Get program ID
program-id:
    @solana address -k target/deploy/zkgate-keypair.json

# ============================================================================
# Frontend
# ============================================================================

# Install frontend dependencies
frontend-install:
    @echo "Installing frontend dependencies..."
    cd app && npm install

# Run frontend dev server
frontend-dev:
    @echo "Starting frontend dev server..."
    cd app && npm run dev

# Build frontend for production
frontend-build:
    @echo "Building frontend..."
    cd app && npm run build

# Copy IDL to frontend
copy-idl:
    @echo "Copying IDL to frontend..."
    cp target/idl/zkgate.json app/public/

# ============================================================================
# Full Workflow
# ============================================================================

# Complete setup (first time)
setup: install wallet compile-all test-circuits build
    @echo "Setup complete!"

# Full build and deploy workflow
full-deploy: compile-all setup-all build deploy copy-idl
    @echo "Full deployment complete!"

# Development workflow
dev: compile-all build frontend-dev

# ============================================================================
# Utilities
# ============================================================================

# Check balances
balance:
    @solana balance

# Airdrop SOL (devnet)
airdrop:
    @solana airdrop 2

# Create test tokens
create-tokens:
    @echo "Creating test tokens..."
    spl-token create-token --decimals 9
    spl-token create-token --decimals 9

# Clean build artifacts
clean:
    @echo "Cleaning build artifacts..."
    rm -rf target/
    rm -rf circuits/*/target/
    rm -rf keys/
    rm -rf app/.next/
    rm -rf app/node_modules/

# Show config
config:
    @solana config get
    @echo ""
    @anchor --version
    @nargo --version
