#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT_DIR="$PROJECT_ROOT/circuits/token_holder"
TARGET_DIR="$CIRCUIT_DIR/target"

echo "=========================================="
echo "Redeploying Verifier for Token Holder"
echo "=========================================="

# Check tools
command -v sunspot >/dev/null 2>&1 || { print_error "sunspot not found"; exit 1; }
command -v solana >/dev/null 2>&1 || { print_error "solana not found"; exit 1; }

# 1. Compile Circuit
echo "Compiling circuit..."
cd "$CIRCUIT_DIR"
nargo compile
print_status "Nargo compiled"

# 2. Sunspot Compile
echo "Sunspot compiling..."
sunspot compile target/token_holder.json
print_status "Sunspot compiled (CCS generated)"

# 3. Sunspot Setup (Generate Keys)
echo "Generating keys..."
sunspot setup target/token_holder.ccs
print_status "Keys generated (PK/VK)"

# 4. Build Verifier Program
echo "Building Verifier..."
rm -rf target/verifier # Clean previous build
sunspot deploy target/token_holder.vk
print_status "Verifier built"

# 5. Locate and Deploy
# 'sunspot deploy' creates a directory (usually 'verifier' or similar) or an SO file.
# Let's find it.
VERIFIER_PATH=""
if [ -f "$TARGET_DIR/verifier.so" ]; then
    VERIFIER_PATH="$TARGET_DIR/verifier.so"
elif [ -f "verifier/webview.so" ]; then # Some versions output here
    VERIFIER_PATH="verifier/webview.so"
elif [ -d "verifier" ]; then
    # Standard output is a 'verifier' folder with a Solana project
    echo "Found verifier directory."
    cd verifier
    
    # Check if built, else build
    if [ ! -f "target/deploy/verifier.so" ]; then
        echo "Building Verifier Rust project..."
        cargo build-bpf
    fi
    VERIFIER_PATH="$(pwd)/target/deploy/verifier.so"
fi

# Fallback search
if [ -z "$VERIFIER_PATH" ]; then
    VERIFIER_PATH=$(find . -name "*.so" | head -n 1)
fi

if [ -z "$VERIFIER_PATH" ]; then
    print_error "Could not find built verifier.so"
    exit 1
fi

echo "Deploying Verifier from: $VERIFIER_PATH"
PROGRAM_ID=$(solana program deploy "$VERIFIER_PATH" --program-id "$PROJECT_ROOT/target/deploy/verifier-keypair.json" --keypair "$PROJECT_ROOT/deployer.json" 2>/dev/null || solana program deploy "$VERIFIER_PATH" --keypair "$PROJECT_ROOT/deployer.json")

# Capture ID if deploy returns text, but 'solana program deploy' output puts ID at end
# Let's just grep typical output or assume success and get ID from keypair if used
# We didn't enforce a keypair, so it generated a new ID.
# Let's explicitly generate a keypair to have a stable ID if we wanted, but for now just get the ID.

# Re-run deploy with json output to grab ID
echo "Deploying..."
DEPLOY_OUTPUT=$(solana program deploy "$VERIFIER_PATH" --keypair "$PROJECT_ROOT/deployer.json")
echo "$DEPLOY_OUTPUT"
NEW_PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep "Program Id:" | awk '{print $3}')

if [ -z "$NEW_PROGRAM_ID" ]; then
    print_error "Deployment failed or ID not found"
    exit 1
fi

print_status "Verifier Deployed! ID: $NEW_PROGRAM_ID"

# 6. Update Config
echo "Updating .env.local..."
# Use sed to replace NEXT_PUBLIC_VERIFIER_PROGRAM_ID
sed -i.bak "s/NEXT_PUBLIC_VERIFIER_PROGRAM_ID=.*/NEXT_PUBLIC_VERIFIER_PROGRAM_ID=$NEW_PROGRAM_ID/" "$PROJECT_ROOT/app/.env.local"
rm -f "$PROJECT_ROOT/app/.env.local.bak"

print_status "Config updated."
echo "=========================================="
echo "PLEASE RESTART THE FRONTEND TO PICK UP THE NEW ID"
echo "=========================================="
