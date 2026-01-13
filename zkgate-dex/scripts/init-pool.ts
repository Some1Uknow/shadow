/**
 * Initialize Pool On-Chain
 * Run after create-pool.ts to actually create the pool account
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    Connection,
    Keypair,
    PublicKey,
} from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';

// Load pool config
const configPath = path.join(__dirname, '..', 'pool-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Load deployer keypair
const deployerPath = path.join(__dirname, '..', 'deployer.json');
const deployerKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(deployerPath, 'utf-8')))
);

// IDL (minimal version for createPool)
const IDL = {
    version: '0.1.0',
    name: 'zkgate',
    address: config.programId,
    instructions: [
        {
            name: 'createPool',
            discriminator: [233, 146, 209, 142, 207, 104, 64, 188],
            accounts: [
                { name: 'pool', writable: true },
                { name: 'tokenAMint' },
                { name: 'tokenBMint' },
                { name: 'tokenAReserve', writable: true },
                { name: 'tokenBReserve', writable: true },
                { name: 'user', writable: true, signer: true },
                { name: 'systemProgram' },
                { name: 'tokenProgram' },
            ],
            args: [
                { name: 'initA', type: 'u64' },
                { name: 'initB', type: 'u64' },
            ],
        },
    ],
    accounts: [],
    types: [],
    errors: [],
};

async function main() {
    console.log('========================================');
    console.log('ZKGate DEX - Initialize Pool On-Chain');
    console.log('========================================\n');

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const wallet = new NodeWallet(deployerKeypair);
    const provider = new AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
    });

    const programId = new PublicKey(config.programId);
    const program = new Program(IDL as any, provider);

    console.log('Program ID:', programId.toBase58());
    console.log('Deployer:', deployerKeypair.publicKey.toBase58());

    const balance = await connection.getBalance(deployerKeypair.publicKey);
    console.log('Balance:', balance / 1e9, 'SOL\n');

    const tokenAMint = new PublicKey(config.tokenAMint);
    const tokenBMint = new PublicKey(config.tokenBMint);
    const poolPda = new PublicKey(config.poolPda);
    const tokenAReserve = new PublicKey(config.poolTokenAReserve);
    const tokenBReserve = new PublicKey(config.poolTokenBReserve);

    // Initial liquidity amounts (10 tokens each)
    const initA = new BN(10 * 1e9);
    const initB = new BN(10 * 1e9);

    console.log('Creating pool with:');
    console.log('  Token A Mint:', tokenAMint.toBase58());
    console.log('  Token B Mint:', tokenBMint.toBase58());
    console.log('  Pool PDA:', poolPda.toBase58());
    console.log('  Initial Liquidity: 10 Token A, 10 Token B\n');

    try {
        const tx = await (program.methods as any)
            .createPool(initA, initB)
            .accounts({
                pool: poolPda,
                tokenAMint: tokenAMint,
                tokenBMint: tokenBMint,
                tokenAReserve: tokenAReserve,
                tokenBReserve: tokenBReserve,
                user: deployerKeypair.publicKey,
                systemProgram: new PublicKey('11111111111111111111111111111111'),
                tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            })
            .signers([deployerKeypair])
            .rpc();

        console.log('✅ Pool created successfully!');
        console.log('Transaction:', tx);
        console.log('\nView on Solana Explorer:');
        console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    } catch (error: any) {
        if (error.message?.includes('already in use')) {
            console.log('Pool already exists!');
        } else {
            console.error('Error creating pool:', error);
        }
    }
}

main().catch(console.error);
