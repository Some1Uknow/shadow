#!/bin/bash
# ZKGate DEX - Full Deployment Script for Devnet

set -e

echo "=========================================="
echo "ZKGate DEX - Devnet Deployment"
echo "=========================================="

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# Check prerequisites
echo ""
echo "Checking prerequisites..."
echo "-------------------------------------------"

command -v solana >/dev/null 2>&1 || { print_error "solana-cli not found"; exit 1; }
command -v anchor >/dev/null 2>&1 || { print_error "anchor not found"; exit 1; }
command -v nargo >/dev/null 2>&1 || { print_error "nargo not found"; exit 1; }

print_status "All prerequisites found"

# Check wallet
if [ ! -f "deployer.json" ]; then
    print_error "deployer.json not found. Run ./scripts/wallet-setup.sh first"
    exit 1
fi

BALANCE=$(solana balance 2>/dev/null | awk '{print $1}')
if (( $(echo "$BALANCE < 1" | bc -l) )); then
    print_warning "Low balance: $BALANCE SOL. Requesting airdrop..."
    solana airdrop 2 || true
    sleep 3
fi

print_status "Wallet ready: $(solana address)"

# Step 1: Compile circuits
echo ""
echo "Step 1: Compiling Noir circuits..."
echo "-------------------------------------------"

for circuit in min_balance token_holder smt_exclusion shielded_spend; do
    echo "Compiling $circuit..."
    cd "circuits/$circuit"
    nargo compile
    cd "$PROJECT_ROOT"
    print_status "$circuit compiled"
done

# Step 2: Build Anchor program
echo ""
echo "Step 2: Building Anchor program..."
echo "-------------------------------------------"

anchor build
print_status "Anchor program built"

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/zkgate-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Update program ID in lib.rs if needed
if grep -q "ZKGate11111111111111111111111111111111111" programs/zkgate/src/lib.rs; then
    print_warning "Updating program ID in lib.rs..."
    sed -i.bak "s/ZKGate11111111111111111111111111111111111/$PROGRAM_ID/" programs/zkgate/src/lib.rs
    rm -f programs/zkgate/src/lib.rs.bak
    
    # Rebuild with correct ID
    anchor build
    print_status "Program rebuilt with correct ID"
fi

# Step 3: Deploy to devnet
echo ""
echo "Step 3: Deploying to devnet..."
echo "-------------------------------------------"

solana config set --url https://api.devnet.solana.com
anchor deploy --provider.cluster devnet

print_status "Program deployed to devnet"
echo "Program ID: $PROGRAM_ID"
echo "Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"

# Step 4: Copy IDL to frontend
echo ""
echo "Step 4: Updating frontend..."
echo "-------------------------------------------"

mkdir -p app/public
cp target/idl/zkgate.json app/public/
print_status "IDL copied to frontend"

# Update program ID in frontend
if [ -f "app/src/hooks/useProgram.ts" ]; then
    sed -i.bak "s/ZKGate11111111111111111111111111111111111/$PROGRAM_ID/" app/src/hooks/useProgram.ts
    rm -f app/src/hooks/useProgram.ts.bak
    print_status "Frontend program ID updated"
fi

# Summary
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Program ID: $PROGRAM_ID"
echo "Network: Devnet"
echo ""
echo "Next steps:"
echo "  1. Create test tokens: spl-token create-token"
echo "  2. Create pool: Use the program to initialize a pool"
echo "  3. Start frontend: cd app && npm run dev"
echo ""
echo "View on explorer:"
echo "  https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo ""
