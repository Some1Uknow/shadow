import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
    getOrCreateAssociatedTokenAccount,
    mintTo,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEVNET_URL = 'https://api.devnet.solana.com';
const USER_WALLET = new PublicKey('7mg1vmKcfZboy8Kkkwdsrc3kEsJsZvbnuKiHK8sJw6Ms');
const AMOUNT = 1000 * 1e9; // 1,000 tokens

async function main() {
    console.log('========================================');
    console.log('ZKGate DEX - Fund User Wallet (Mint)');
    console.log('========================================\n');

    // Load deployer keypair
    const deployerPath = path.join(__dirname, '..', 'deployer.json');
    if (!fs.existsSync(deployerPath)) {
        console.error('Error: deployer.json not found.');
        process.exit(1);
    }
    const deployerSecret = JSON.parse(fs.readFileSync(deployerPath, 'utf-8'));
    const deployer = Keypair.fromSecretKey(Uint8Array.from(deployerSecret));

    // Load config
    const configPath = path.join(__dirname, '..', 'pool-config.json');
    if (!fs.existsSync(configPath)) {
        console.error('Error: pool-config.json not found. Run create-pool.ts first.');
        process.exit(1);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    const tokenAMint = new PublicKey(config.tokenAMint);
    const tokenBMint = new PublicKey(config.tokenBMint);

    const connection = new Connection(DEVNET_URL, 'confirmed');
    console.log(`Funding User: ${USER_WALLET.toBase58()}`);

    // Create User ATAs (if needed)
    console.log('Ensuring User ATAs exist...');
    const userTokenA = await getOrCreateAssociatedTokenAccount(
        connection,
        deployer, // Payer
        tokenAMint,
        USER_WALLET
    );
    const userTokenB = await getOrCreateAssociatedTokenAccount(
        connection,
        deployer, // Payer
        tokenBMint,
        USER_WALLET
    );

    console.log('Minting tokens to user...');

    // Mint A
    await mintTo(
        connection,
        deployer,
        tokenAMint,
        userTokenA.address,
        deployer, // Authority
        AMOUNT
    );
    console.log('Minted 1,000 Token A');

    // Mint B
    await mintTo(
        connection,
        deployer,
        tokenBMint,
        userTokenB.address,
        deployer, // Authority
        AMOUNT
    );
    console.log('Minted 1,000 Token B');

    console.log(`Success! Minted 1,000 A and 1,000 B to user.`);
}

main().catch(console.error);
