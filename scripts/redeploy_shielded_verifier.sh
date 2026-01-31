#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT_DIR="$PROJECT_ROOT/circuits/shielded_spend"
TARGET_DIR="$CIRCUIT_DIR/target"

echo "=========================================="
echo "Redeploying Verifier for Shielded Spend"
echo "=========================================="

command -v sunspot >/dev/null 2>&1 || { print_error "sunspot not found"; exit 1; }
command -v solana >/dev/null 2>&1 || { print_error "solana not found"; exit 1; }
command -v nargo >/dev/null 2>&1 || { print_error "nargo not found"; exit 1; }

RPC_URL="${SOLANA_RPC_URL:-${NEXT_PUBLIC_RPC_ENDPOINT:-}}"
if [ -z "$RPC_URL" ] && [ -f "$PROJECT_ROOT/app/.env.local" ]; then
    RPC_URL=$(grep -E '^NEXT_PUBLIC_RPC_ENDPOINT=' "$PROJECT_ROOT/app/.env.local" | head -n 1 | cut -d= -f2-)
fi

echo "Compiling circuit..."
cd "$CIRCUIT_DIR"
nargo compile
print_status "nargo compiled"

echo "Sunspot compiling..."
sunspot compile target/shielded_spend.json
print_status "sunspot compiled (ccs generated)"

echo "Generating keys..."
sunspot setup target/shielded_spend.ccs
print_status "keys generated (pk/vk)"

echo "Building verifier..."
rm -rf target/verifier
sunspot deploy target/shielded_spend.vk
print_status "verifier built"

VERIFIER_PATH=""
if [ -f "$TARGET_DIR/verifier.so" ]; then
    VERIFIER_PATH="$TARGET_DIR/verifier.so"
elif [ -f "verifier/webview.so" ]; then
    VERIFIER_PATH="verifier/webview.so"
elif [ -d "verifier" ]; then
    echo "Found verifier directory."
    cd verifier
    if [ ! -f "target/deploy/verifier.so" ]; then
        echo "Building verifier rust project..."
        cargo build-bpf
    fi
    VERIFIER_PATH="$(pwd)/target/deploy/verifier.so"
fi

if [ -z "$VERIFIER_PATH" ]; then
    VERIFIER_PATH=$(find . -name "*.so" | head -n 1)
fi

if [ -z "$VERIFIER_PATH" ]; then
    print_error "Could not find built verifier.so"
    exit 1
fi

echo "Deploying verifier from: $VERIFIER_PATH"
if [ -n "$RPC_URL" ]; then
    DEPLOY_OUTPUT=$(solana program deploy "$VERIFIER_PATH" --url "$RPC_URL" --keypair "$PROJECT_ROOT/deployer.json")
else
    DEPLOY_OUTPUT=$(solana program deploy "$VERIFIER_PATH" --keypair "$PROJECT_ROOT/deployer.json")
fi
echo "$DEPLOY_OUTPUT"
NEW_PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep "Program Id:" | awk '{print $3}')

if [ -z "$NEW_PROGRAM_ID" ]; then
    print_error "Deployment failed or program id not found"
    exit 1
fi

print_status "Verifier deployed: $NEW_PROGRAM_ID"

ENV_PATH="$PROJECT_ROOT/app/.env.local"
if [ -f "$ENV_PATH" ]; then
    sed -i.bak "s/NEXT_PUBLIC_SHIELDED_VERIFIER_PROGRAM_ID=.*/NEXT_PUBLIC_SHIELDED_VERIFIER_PROGRAM_ID=$NEW_PROGRAM_ID/" "$ENV_PATH"
    rm -f "$ENV_PATH.bak"
    print_status "app/.env.local updated"
else
    print_warning "app/.env.local not found. Update NEXT_PUBLIC_SHIELDED_VERIFIER_PROGRAM_ID manually."
fi

echo "=========================================="
echo "Restart the app server to pick up the new verifier id."
echo "=========================================="
