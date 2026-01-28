/**
 * Test swap simulation to debug "program does not exist" error
 */
import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';

// Load config
const configPath = path.join(__dirname, '..', 'pool-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Load deployer keypair
const deployerPath = path.join(__dirname, '..', 'deployer.json');
const deployerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(deployerPath, 'utf-8')))
);

// Minimal IDL for zkSwap
const IDL = {
    version: '0.1.0',
    name: 'zkgate',
    address: config.programId,
    instructions: [
        {
            name: 'zkSwap',
            discriminator: [145, 56, 183, 78, 234, 167, 89, 12],  // Will get from actual IDL
            accounts: [
                { name: 'pool', writable: true },
                { name: 'userTokenA', writable: true },
                { name: 'userTokenB', writable: true },
                { name: 'tokenAReserve', writable: true },
                { name: 'tokenBReserve', writable: true },
                { name: 'user', signer: true },
                { name: 'verifierProgram' },
                { name: 'verifierState' },
                { name: 'tokenProgram' },
            ],
            args: [
                { name: 'amountIn', type: 'u64' },
                { name: 'minOut', type: 'u64' },
                { name: 'proof', type: { vec: 'u8' } },
                { name: 'publicInputs', type: { vec: 'u8' } },
            ],
        },
    ],
    accounts: [],
    types: [],
    errors: [],
};

// RPC endpoint from environment or default to devnet
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';

async function main() {
    console.log('=== Test Swap Simulation ===\n');
    console.log('RPC:', RPC_URL);

    const connection = new Connection(RPC_URL, 'confirmed');
    const wallet = new NodeWallet(deployerKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

    console.log('Deployer:', deployerKeypair.publicKey.toBase58());

    // Check programs exist
    console.log('\nChecking programs:');
    const programId = new PublicKey(config.programId);
    const verifierProgramId = new PublicKey('GtS9r61Tv7s78nR5D61hFczb2Uau1eRVf176xXNAajuD');

    const dexInfo = await connection.getAccountInfo(programId);
    console.log('DEX Program:', programId.toBase58(), dexInfo ? '✅ exists' : '❌ MISSING');

    const verifierInfo = await connection.getAccountInfo(verifierProgramId);
    console.log('Verifier Program:', verifierProgramId.toBase58(), verifierInfo ? '✅ exists' : '❌ MISSING');

    if (verifierInfo) {
        console.log('  - Executable:', verifierInfo.executable);
        console.log('  - Owner:', verifierInfo.owner.toBase58());
        console.log('  - Data length:', verifierInfo.data.length);
    }

    // Check pool exists
    const poolPda = new PublicKey(config.poolPda);
    const poolInfo = await connection.getAccountInfo(poolPda);
    console.log('Pool PDA:', poolPda.toBase58(), poolInfo ? '✅ exists' : '❌ MISSING');

    // Check token accounts
    const userTokenA = await getAssociatedTokenAddress(
        new PublicKey(config.tokenAMint),
        deployerKeypair.publicKey
    );
    const userTokenAInfo = await connection.getAccountInfo(userTokenA);
    console.log('User Token A:', userTokenA.toBase58(), userTokenAInfo ? '✅ exists' : '❌ MISSING');

    const userTokenB = await getAssociatedTokenAddress(
        new PublicKey(config.tokenBMint),
        deployerKeypair.publicKey
    );
    const userTokenBInfo = await connection.getAccountInfo(userTokenB);
    console.log('User Token B:', userTokenB.toBase58(), userTokenBInfo ? '✅ exists' : '❌ MISSING');

    const tokenAReserve = new PublicKey(config.poolTokenAReserve);
    const tokenAReserveInfo = await connection.getAccountInfo(tokenAReserve);
    console.log('Token A Reserve:', tokenAReserve.toBase58(), tokenAReserveInfo ? '✅ exists' : '❌ MISSING');

    const tokenBReserve = new PublicKey(config.poolTokenBReserve);
    const tokenBReserveInfo = await connection.getAccountInfo(tokenBReserve);
    console.log('Token B Reserve:', tokenBReserve.toBase58(), tokenBReserveInfo ? '✅ exists' : '❌ MISSING');

    console.log('\n✅ All accounts verified. Issue is likely in proof format or CPI call.');
}

main().catch(console.error);
