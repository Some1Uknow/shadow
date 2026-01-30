/**
 * Update shielded pool root (sequencer/relayer authority).
 *
 * Usage:
 *   npx ts-node scripts/update-shielded-root.ts <shieldedPoolPubkey> <rootHexOrBase58> <includedLeaves>
 *
 * Root should be 32 bytes hex (0x...) or base58-encoded raw bytes.
 */

import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';

function toBeBytes32(value: bigint): number[] {
  const out = new Array(32).fill(0);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & BigInt(0xff));
    v >>= BigInt(8);
  }
  return out;
}

function parseRoot(input: string): number[] {
  if (input.startsWith('0x')) {
    const hex = input.slice(2);
    const bytes = Buffer.from(hex, 'hex');
    if (bytes.length !== 32) {
      throw new Error('Root must be 32 bytes');
    }
    return Array.from(bytes);
  }
  if (/^\d+$/.test(input)) {
    return toBeBytes32(BigInt(input));
  }
  const bytes = bs58.decode(input);
  if (bytes.length !== 32) {
    throw new Error('Root must be 32 bytes');
  }
  return Array.from(bytes);
}

async function main() {
  const [shieldedPoolKey, rootInput, includedLeaves] = process.argv.slice(2);
  if (!shieldedPoolKey || !rootInput || !includedLeaves) {
    console.error('Usage: update-shielded-root <shieldedPoolPubkey> <root> <includedLeaves>');
    process.exit(1);
  }

  const deployerPath = path.join(__dirname, '..', 'deployer.json');
  if (!fs.existsSync(deployerPath)) {
    throw new Error('deployer.json not found');
  }

  const secret = JSON.parse(fs.readFileSync(deployerPath, 'utf-8'));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));

  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = require('../target/idl/zkgate.json');
  const program = new Program(idl, provider);

  const rootBytes = parseRoot(rootInput);

  await program.methods
    .updateShieldedRoot(rootBytes, new BN(includedLeaves))
    .accounts({
      shieldedPool: new PublicKey(shieldedPoolKey),
      rootHistory: PublicKey.findProgramAddressSync(
        [Buffer.from('shielded_root'), new PublicKey(shieldedPoolKey).toBuffer()],
        program.programId
      )[0],
      authority: keypair.publicKey,
    })
    .signers([keypair])
    .rpc();

  console.log('Shielded root updated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
