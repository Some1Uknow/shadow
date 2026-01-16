#!/bin/bash
# ZKGate DEX - Wallet Setup for Devnet

set -e

echo "=========================================="
echo "ZKGate DEX - Wallet Setup"
echo "=========================================="
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

# Check if deployer.json exists
if [ -f "deployer.json" ]; then
    print_warning "deployer.json already exists"
    read -p "Overwrite? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Using existing wallet"
    else
        rm deployer.json
    fi
fi

# Generate new keypair if needed
if [ ! -f "deployer.json" ]; then
    echo "Generating new keypair..."
    solana-keygen new --outfile deployer.json --no-bip39-passphrase
    print_status "Keypair generated"
fi

# Configure Solana CLI
echo ""
echo "Configuring Solana CLI for devnet..."
solana config set --url https://api.devnet.solana.com
solana config set --keypair "$PROJECT_ROOT/deployer.json"
print_status "Solana CLI configured"

# Get address
ADDRESS=$(solana address)
echo ""
echo "Wallet Address: $ADDRESS"

# Check balance
BALANCE=$(solana balance 2>/dev/null | awk '{print $1}')
echo "Current Balance: $BALANCE SOL"

# Airdrop if needed
if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo ""
    echo "Requesting airdrop..."
    
    # Try multiple airdrops (devnet has limits)
    for i in 1 2 3; do
        solana airdrop 2 2>/dev/null || true
        sleep 2
    done
    
    NEW_BALANCE=$(solana balance 2>/dev/null | awk '{print $1}')
    print_status "New balance: $NEW_BALANCE SOL"
fi

# Summary
echo ""
echo "=========================================="
echo "Wallet Setup Complete!"
echo "=========================================="
echo ""
echo "Address: $ADDRESS"
echo "Keypair: $PROJECT_ROOT/deployer.json"
echo "Network: Devnet"
echo ""
echo "View on explorer:"
echo "  https://explorer.solana.com/address/$ADDRESS?cluster=devnet"
echo ""
echo "To add more SOL:"
echo "  solana airdrop 2"
echo ""
