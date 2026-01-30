/**
 * ZKGate DEX - Pool Creation Script
 * 
 * Creates test tokens and initializes a liquidity pool on devnet
 * 
 * Usage: npx ts-node scripts/create-pool.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEVNET_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const INITIAL_LIQUIDITY_A = 10_000_000_000; // 10,000 tokens (9 decimals)
const INITIAL_LIQUIDITY_B = 10_000_000_000; // 10,000 tokens (9 decimals)

async function main() {
  console.log('========================================');
  console.log('ZKGate DEX - Pool Creation');
  console.log('========================================\n');

  // Load deployer keypair
  const deployerPath = path.join(__dirname, '..', 'deployer.json');
  if (!fs.existsSync(deployerPath)) {
    console.error('Error: deployer.json not found. Run wallet-setup.sh first.');
    process.exit(1);
  }

  const deployerSecret = JSON.parse(fs.readFileSync(deployerPath, 'utf-8'));
  const deployer = Keypair.fromSecretKey(Uint8Array.from(deployerSecret));
  console.log(`Deployer: ${deployer.publicKey.toBase58()}`);

  // Connect to devnet
  const connection = new Connection(DEVNET_URL, 'confirmed');
  const balance = await connection.getBalance(deployer.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL\n`);

  if (balance < 0.5 * 1e9) {
    console.log('Requesting airdrop...');
    const sig = await connection.requestAirdrop(deployer.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig);
    console.log('Airdrop received\n');
  }

  // Step 1: Create Token A
  console.log('Step 1: Creating Token A...');
  const tokenAMint = await createMint(
    connection,
    deployer,
    deployer.publicKey,
    deployer.publicKey,
    9 // decimals
  );
  console.log(`Token A Mint: ${tokenAMint.toBase58()}`);

  // Step 2: Create Token B
  console.log('\nStep 2: Creating Token B...');
  const tokenBMint = await createMint(
    connection,
    deployer,
    deployer.publicKey,
    deployer.publicKey,
    9
  );
  console.log(`Token B Mint: ${tokenBMint.toBase58()}`);

  // Step 3: Create ATAs for deployer
  console.log('\nStep 3: Creating token accounts...');
  const deployerTokenA = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    tokenAMint,
    deployer.publicKey
  );
  const deployerTokenB = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    tokenBMint,
    deployer.publicKey
  );
  console.log(`Deployer Token A ATA: ${deployerTokenA.address.toBase58()}`);
  console.log(`Deployer Token B ATA: ${deployerTokenB.address.toBase58()}`);

  // Step 4: Mint initial tokens
  console.log('\nStep 4: Minting initial tokens...');
  await mintTo(
    connection,
    deployer,
    tokenAMint,
    deployerTokenA.address,
    deployer,
    INITIAL_LIQUIDITY_A * 2 // Extra for testing
  );
  await mintTo(
    connection,
    deployer,
    tokenBMint,
    deployerTokenB.address,
    deployer,
    INITIAL_LIQUIDITY_B * 2
  );
  console.log(`Minted ${INITIAL_LIQUIDITY_A * 2 / 1e9} Token A`);
  console.log(`Minted ${INITIAL_LIQUIDITY_B * 2 / 1e9} Token B`);

  // Step 5: Compute Pool PDA
  console.log('\nStep 5: Computing Pool PDA...');

  // Load program ID from keypair
  const programKeypairPath = path.join(__dirname, '..', 'target', 'deploy', 'zkgate-keypair.json');
  let programId: PublicKey;

  if (fs.existsSync(programKeypairPath)) {
    const programSecret = JSON.parse(fs.readFileSync(programKeypairPath, 'utf-8'));
    const programKeypair = Keypair.fromSecretKey(Uint8Array.from(programSecret));
    programId = programKeypair.publicKey;
  } else {
    // Fallback to placeholder
    programId = new PublicKey('ZKGate11111111111111111111111111111111111');
  }
  console.log(`Program ID: ${programId.toBase58()}`);

  const [poolPda, poolBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
    programId
  );
  console.log(`Pool PDA: ${poolPda.toBase58()}`);

  // Shielded pool PDAs (one per mint)
  const [shieldedPoolA] = PublicKey.findProgramAddressSync(
    [Buffer.from('shielded_pool'), tokenAMint.toBuffer()],
    programId
  );
  const [shieldedPoolB] = PublicKey.findProgramAddressSync(
    [Buffer.from('shielded_pool'), tokenBMint.toBuffer()],
    programId
  );
  const [shieldedRootHistoryA] = PublicKey.findProgramAddressSync(
    [Buffer.from('shielded_root'), shieldedPoolA.toBuffer()],
    programId
  );
  const [shieldedRootHistoryB] = PublicKey.findProgramAddressSync(
    [Buffer.from('shielded_root'), shieldedPoolB.toBuffer()],
    programId
  );
  console.log(`Shielded Pool A: ${shieldedPoolA.toBase58()}`);
  console.log(`Shielded Pool B: ${shieldedPoolB.toBase58()}`);

  const shieldedVaultA = await getAssociatedTokenAddress(
    tokenAMint,
    shieldedPoolA,
    true
  );
  const shieldedVaultB = await getAssociatedTokenAddress(
    tokenBMint,
    shieldedPoolB,
    true
  );

  // Step 6: Create pool reserve ATAs (owned by pool PDA)
  console.log('\nStep 6: Creating pool reserve accounts...');
  const poolTokenAReserve = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    tokenAMint,
    poolPda,
    true // allowOwnerOffCurve for PDA
  );
  const poolTokenBReserve = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    tokenBMint,
    poolPda,
    true
  );
  console.log(`Pool Token A Reserve: ${poolTokenAReserve.address.toBase58()}`);
  console.log(`Pool Token B Reserve: ${poolTokenBReserve.address.toBase58()}`);

  // Step 7: Initialize Pool on-chain
  console.log('\nStep 7: Initializing Pool on-chain...');

  // Create provider
  const wallet = new Wallet(deployer);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  // Load IDL
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = require('../target/idl/zkgate.json');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = new Program(idl, provider); // programId is inferred from valid IDL or provider if not passed? Anchor requires address usually

  // Re-instantiate program with address
  const programConnected = new Program(idl, provider);

  try {
    await programConnected.methods
      .createPool(
        new BN(INITIAL_LIQUIDITY_A),
        new BN(INITIAL_LIQUIDITY_B)
      )
      .accounts({
        pool: poolPda,
        tokenAMint: tokenAMint,
        tokenBMint: tokenBMint,
        tokenAReserve: poolTokenAReserve.address,
        tokenBReserve: poolTokenBReserve.address,
        user: deployer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([deployer])
      .rpc();
    console.log('Pool initialized!');

    console.log('\nStep 7b: Initializing shielded pools...');
    await programConnected.methods
      .initializeShieldedPool()
      .accounts({
        shieldedPool: shieldedPoolA,
        mint: tokenAMint,
        vault: shieldedVaultA,
        authority: deployer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
      })
      .signers([deployer])
      .rpc();

    await programConnected.methods
      .initializeShieldedRootHistory()
      .accounts({
        shieldedPool: shieldedPoolA,
        rootHistory: shieldedRootHistoryA,
        authority: deployer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([deployer])
      .rpc();

    await programConnected.methods
      .initializeShieldedPool()
      .accounts({
        shieldedPool: shieldedPoolB,
        mint: tokenBMint,
        vault: shieldedVaultB,
        authority: deployer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
      })
      .signers([deployer])
      .rpc();

    await programConnected.methods
      .initializeShieldedRootHistory()
      .accounts({
        shieldedPool: shieldedPoolB,
        rootHistory: shieldedRootHistoryB,
        authority: deployer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([deployer])
      .rpc();
    console.log('Shielded pools initialized!');

    console.log('\nStep 8: Transferring initial liquidity to reserves...');
    // Transfer A to Reserve A
    const transferAIx = await import('@solana/spl-token').then(spl => spl.createTransferInstruction(
      deployerTokenA.address,
      poolTokenAReserve.address,
      deployer.publicKey,
      INITIAL_LIQUIDITY_A
    ));

    // Transfer B to Reserve B
    const transferBIx = await import('@solana/spl-token').then(spl => spl.createTransferInstruction(
      deployerTokenB.address,
      poolTokenBReserve.address,
      deployer.publicKey,
      INITIAL_LIQUIDITY_B
    ));

    const tx = new Transaction().add(transferAIx, transferBIx);
    await sendAndConfirmTransaction(connection, tx, [deployer]);
    console.log('Liquidity transferred!');

  } catch (e) {
    console.error('Initialization failed:', e);
    // If it failed because already exists, that's fine, we proceed
    if (String(e).includes('already in use')) {
      console.log('Pool account already exists (proceeding).');
    } else {
      throw e;
    }
  }

  // Save configuration
  const config = {
    network: 'devnet',
    programId: programId.toBase58(),
    tokenAMint: tokenAMint.toBase58(),
    tokenBMint: tokenBMint.toBase58(),
    poolPda: poolPda.toBase58(),
    poolTokenAReserve: poolTokenAReserve.address.toBase58(),
    poolTokenBReserve: poolTokenBReserve.address.toBase58(),
    shieldedPoolA: shieldedPoolA.toBase58(),
    shieldedPoolB: shieldedPoolB.toBase58(),
    shieldedVaultA: shieldedVaultA.toBase58(),
    shieldedVaultB: shieldedVaultB.toBase58(),
    shieldedRootHistoryA: shieldedRootHistoryA.toBase58(),
    shieldedRootHistoryB: shieldedRootHistoryB.toBase58(),
    deployerTokenA: deployerTokenA.address.toBase58(),
    deployerTokenB: deployerTokenB.address.toBase58(),
    initialLiquidityA: INITIAL_LIQUIDITY_A,
    initialLiquidityB: INITIAL_LIQUIDITY_B,
  };

  const configPath = path.join(__dirname, '..', 'pool-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\nConfiguration saved to: ${configPath}`);

  // Generate .env.local for frontend
  const envContent = [
    '# Generated by create-pool.ts',
    'NEXT_PUBLIC_NETWORK=devnet',
    `NEXT_PUBLIC_PROGRAM_ID=${programId.toBase58()}`,
    `NEXT_PUBLIC_TOKEN_A_MINT=${tokenAMint.toBase58()}`,
    `NEXT_PUBLIC_TOKEN_B_MINT=${tokenBMint.toBase58()}`,
    `NEXT_PUBLIC_POOL_PDA=${poolPda.toBase58()}`,
    `NEXT_PUBLIC_TOKEN_A_RESERVE=${poolTokenAReserve.address.toBase58()}`,
    `NEXT_PUBLIC_TOKEN_B_RESERVE=${poolTokenBReserve.address.toBase58()}`,
    `NEXT_PUBLIC_SHIELDED_POOL_A=${shieldedPoolA.toBase58()}`,
    `NEXT_PUBLIC_SHIELDED_POOL_B=${shieldedPoolB.toBase58()}`,
    `NEXT_PUBLIC_SHIELDED_VAULT_A=${shieldedVaultA.toBase58()}`,
    `NEXT_PUBLIC_SHIELDED_VAULT_B=${shieldedVaultB.toBase58()}`,
    `NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_A=${shieldedRootHistoryA.toBase58()}`,
    `NEXT_PUBLIC_SHIELDED_ROOT_HISTORY_B=${shieldedRootHistoryB.toBase58()}`,
    '# Set after deploying shielded verifier',
    'NEXT_PUBLIC_SHIELDED_VERIFIER_PROGRAM_ID=11111111111111111111111111111111',
    '# Set these after deploying Sunspot verifier',
    'NEXT_PUBLIC_VERIFIER_PROGRAM_ID=11111111111111111111111111111111',
    'NEXT_PUBLIC_VERIFIER_STATE=11111111111111111111111111111111',
  ].join('\n');

  const envPath = path.join(__dirname, '..', 'app', '.env.local');
  fs.writeFileSync(envPath, envContent);
  console.log(`Frontend env saved to: ${envPath}`);

  // Summary
  console.log('\n========================================');
  console.log('Pool Setup Complete!');
  console.log('========================================\n');
  console.log('Next steps:');
  console.log('  1. Deploy the program: anchor deploy');
  console.log('  2. Call createPool instruction with the above addresses');
  console.log('  3. Update NEXT_PUBLIC_VERIFIER_* in app/.env.local after sunspot deploy');
  console.log('  4. Start frontend: cd app && npm run dev');
  console.log('\nToken Mints:');
  console.log(`  Token A: ${tokenAMint.toBase58()}`);
  console.log(`  Token B: ${tokenBMint.toBase58()}`);
  console.log('\nPool:');
  console.log(`  PDA: ${poolPda.toBase58()}`);
  console.log(`  Reserve A: ${poolTokenAReserve.address.toBase58()}`);
  console.log(`  Reserve B: ${poolTokenBReserve.address.toBase58()}`);
}

main().catch(console.error);
