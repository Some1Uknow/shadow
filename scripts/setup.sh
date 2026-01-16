#!/bin/bash
# ZKGate DEX - Full Setup Script
# Installs all dependencies for development

set -e

echo "=========================================="
echo "ZKGate DEX - Setup Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# Check OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM=linux;;
    Darwin*)    PLATFORM=macos;;
    *)          print_error "Unsupported OS: ${OS}"; exit 1;;
esac
print_status "Detected platform: $PLATFORM"

# ============================================================================
# Rust
# ============================================================================
echo ""
echo "Checking Rust..."
echo "-------------------------------------------"

if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    print_status "Rust installed: $RUST_VERSION"
else
    print_warning "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    print_status "Rust installed"
fi

# ============================================================================
# Solana CLI
# ============================================================================
echo ""
echo "Checking Solana CLI..."
echo "-------------------------------------------"

if command -v solana &> /dev/null; then
    SOLANA_VERSION=$(solana --version)
    print_status "Solana CLI installed: $SOLANA_VERSION"
else
    print_warning "Installing Solana CLI (via Anza)..."
    sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    print_status "Solana CLI installed"
fi

# ============================================================================
# Anchor
# ============================================================================
echo ""
echo "Checking Anchor..."
echo "-------------------------------------------"

if command -v anchor &> /dev/null; then
    ANCHOR_VERSION=$(anchor --version)
    print_status "Anchor installed: $ANCHOR_VERSION"
else
    print_warning "Installing Anchor via AVM..."
    cargo install --git https://github.com/coral-xyz/anchor avm --force
    avm install latest
    avm use latest
    print_status "Anchor installed"
fi

# ============================================================================
# Node.js
# ============================================================================
echo ""
echo "Checking Node.js..."
echo "-------------------------------------------"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js installed: $NODE_VERSION"
else
    print_warning "Node.js not found. Please install via nvm:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "  nvm install 24"
    echo "  nvm use 24"
fi

# ============================================================================
# Noir
# ============================================================================
echo ""
echo "Checking Noir..."
echo "-------------------------------------------"

if command -v nargo &> /dev/null; then
    NARGO_VERSION=$(nargo --version)
    print_status "Noir installed: $NARGO_VERSION"
else
    print_warning "Installing Noir..."
    curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
    export PATH="$HOME/.nargo/bin:$PATH"
    noirup -v 1.0.0-beta.18
    print_status "Noir installed"
fi

# ============================================================================
# Just
# ============================================================================
echo ""
echo "Checking Just..."
echo "-------------------------------------------"

if command -v just &> /dev/null; then
    JUST_VERSION=$(just --version)
    print_status "Just installed: $JUST_VERSION"
else
    print_warning "Installing Just..."
    cargo install just
    print_status "Just installed"
fi

# ============================================================================
# Project Dependencies
# ============================================================================
echo ""
echo "Installing project dependencies..."
echo "-------------------------------------------"

# Frontend
if [ -d "app" ]; then
    cd app
    npm install
    cd ..
    print_status "Frontend dependencies installed"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Installed versions:"
command -v rustc &> /dev/null && echo "  Rust: $(rustc --version)"
command -v solana &> /dev/null && echo "  Solana: $(solana --version)"
command -v anchor &> /dev/null && echo "  Anchor: $(anchor --version)"
command -v node &> /dev/null && echo "  Node.js: $(node --version)"
command -v nargo &> /dev/null && echo "  Noir: $(nargo --version)"
command -v just &> /dev/null && echo "  Just: $(just --version)"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/wallet-setup.sh"
echo "  2. Run: just compile-all"
echo "  3. Run: anchor build"
echo ""
