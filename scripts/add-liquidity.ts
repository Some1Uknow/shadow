/**
 * Add liquidity to the pool
 */
import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';

// Load config
const configPath = path.join(__dirname, '..', 'pool-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Load IDL
const idlPath = path.join(__dirname, '..', 'target', 'idl', 'zkgate.json');
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

// Load deployer keypair
const deployerPath = path.join(__dirname, '..', 'deployer.json');
const deployerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(deployerPath, 'utf-8')))
);

async function main() {
    console.log('=== Add Liquidity to Pool ===\n');

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const wallet = new NodeWallet(deployerKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(IDL, provider);

    const tokenAMint = new PublicKey(config.tokenAMint);
    const tokenBMint = new PublicKey(config.tokenBMint);
    const poolPda = new PublicKey(config.poolPda);
    const tokenAReserve = new PublicKey(config.poolTokenAReserve);
    const tokenBReserve = new PublicKey(config.poolTokenBReserve);

    // Get deployer ATAs
    const deployerTokenA = await getAssociatedTokenAddress(tokenAMint, deployerKeypair.publicKey);
    const deployerTokenB = await getAssociatedTokenAddress(tokenBMint, deployerKeypair.publicKey);

    // Check current balances
    console.log('Current balances:');
    try {
        const reserveAInfo = await getAccount(connection, tokenAReserve);
        console.log('  Reserve A:', Number(reserveAInfo.amount) / 1e9, 'tokens');
    } catch { console.log('  Reserve A: 0 tokens (or error)'); }

    try {
        const reserveBInfo = await getAccount(connection, tokenBReserve);
        console.log('  Reserve B:', Number(reserveBInfo.amount) / 1e9, 'tokens');
    } catch { console.log('  Reserve B: 0 tokens (or error)'); }

    try {
        const userAInfo = await getAccount(connection, deployerTokenA);
        console.log('  Deployer Token A:', Number(userAInfo.amount) / 1e9, 'tokens');
    } catch { console.log('  Deployer Token A: 0 tokens (or error)'); }

    try {
        const userBInfo = await getAccount(connection, deployerTokenB);
        console.log('  Deployer Token B:', Number(userBInfo.amount) / 1e9, 'tokens');
    } catch { console.log('  Deployer Token B: 0 tokens (or error)'); }

    // Add 5 of each token as liquidity
    const amountA = new BN(5 * 1e9);
    const amountB = new BN(5 * 1e9);

    console.log('\nAdding liquidity: 5 Token A, 5 Token B');

    try {
        const tx = await (program.methods as any)
            .addLiquidity(amountA, amountB)
            .accounts({
                pool: poolPda,
                userTokenA: deployerTokenA,
                userTokenB: deployerTokenB,
                tokenAReserve: tokenAReserve,
                tokenBReserve: tokenBReserve,
                user: deployerKeypair.publicKey,
                tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            })
            .signers([deployerKeypair])
            .rpc();

        console.log('✅ Liquidity added successfully!');
        console.log('Transaction:', tx);
    } catch (error: any) {
        console.error('Error adding liquidity:', error.message || error);
    }

    // Check new balances
    console.log('\nNew balances:');
    try {
        const reserveAInfo = await getAccount(connection, tokenAReserve);
        console.log('  Reserve A:', Number(reserveAInfo.amount) / 1e9, 'tokens');
    } catch { console.log('  Reserve A: error'); }

    try {
        const reserveBInfo = await getAccount(connection, tokenBReserve);
        console.log('  Reserve B:', Number(reserveBInfo.amount) / 1e9, 'tokens');
    } catch { console.log('  Reserve B: error'); }
}

main().catch(console.error);
