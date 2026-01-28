---
description: How to deploy Shadow DEX to Fly.io
---

# Deploy to Fly.io

## Prerequisites
// turbo
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
// turbo
2. Login: `fly auth login`

## First Time Setup
// turbo
1. Create app (one-time): `fly apps create shadow-dex`
// turbo
2. Set secrets (replace with your values):
   ```bash
   fly secrets set \
     NEXT_PUBLIC_NETWORK=devnet \
     NEXT_PUBLIC_PROGRAM_ID=GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d \
     NEXT_PUBLIC_TOKEN_A_MINT=BzzNnKq1sJfkeUH7iyi823HDwCBSxYBx4s3epbvpvYqk \
     NEXT_PUBLIC_TOKEN_B_MINT=CSxuownDqx9oVqojxAedaSmziKeFPRwFbmaoRCK1hrRc \
     NEXT_PUBLIC_POOL_PDA=8Jh3FgSqwiRY1G1gu9cfSMZJCGgV7qDkC3BHG5Sga5fC \
     NEXT_PUBLIC_TOKEN_A_RESERVE=C3Lr7Nx9mrd3BnRZJzJd1GB4FFGTvRunYxRFgbVpp7sW \
     NEXT_PUBLIC_TOKEN_B_RESERVE=5zyCx4tXjUhvuaa87D8grTuMUnbEDQZy1xgFG4TjbdCf \
     NEXT_PUBLIC_VERIFIER_PROGRAM_ID=95uEYS5q8LnrfgxAGbZwYn5gbSfsbmRPKiibF5a9P2Qz \
     NEXT_PUBLIC_VERIFIER_STATE=11111111111111111111111111111111 \
     NEXT_PUBLIC_RPC_ENDPOINT=<YOUR_RPC_ENDPOINT>
   ```

## Deploy
// turbo-all
```bash
fly deploy
```

## Verify
1. Check status: `fly status`
2. View logs: `fly logs`
3. Test health: `curl https://shadow-dex.fly.dev/api/prove`

## Troubleshooting
- Logs: `fly logs --app shadow-dex`
- SSH into machine: `fly ssh console`
- Check tools: `fly ssh console -C "nargo --version && sunspot --help | head -1"`
