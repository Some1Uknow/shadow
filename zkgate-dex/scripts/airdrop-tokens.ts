/**
 * Airdrop tokens to a user wallet
 */
import * as fs from 'fs';
import * as path from 'path';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';

// Target wallet - change this to the recipient
const RECIPIENT = process.argv[2] || '7mg1w6MsTPCNsLvEvLvCjqbFY7XZCHhFvBrJeM9yw6Ms';

async function main() {
    // Load config
    const configPath = path.join(__dirname, '..', 'pool-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Load deployer
    const deployerPath = path.join(__dirname, '..', 'deployer.json');
    const deployer = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(deployerPath, 'utf-8')))
    );

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const recipient = new PublicKey(RECIPIENT);

    console.log('Airdropping tokens to:', recipient.toBase58());
    console.log('From deployer:', deployer.publicKey.toBase58());

    const tokenAMint = new PublicKey(config.tokenAMint);
    const tokenBMint = new PublicKey(config.tokenBMint);

    // Get or create recipient ATAs
    console.log('\nCreating token accounts for recipient...');

    const recipientTokenA = await getOrCreateAssociatedTokenAccount(
        connection,
        deployer,
        tokenAMint,
        recipient
    );
    console.log('Recipient Token A ATA:', recipientTokenA.address.toBase58());

    const recipientTokenB = await getOrCreateAssociatedTokenAccount(
        connection,
        deployer,
        tokenBMint,
        recipient
    );
    console.log('Recipient Token B ATA:', recipientTokenB.address.toBase58());

    // Get deployer ATAs
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

    // Transfer 5 of each token
    const amount = 5 * 1_000_000_000; // 5 tokens with 9 decimals

    console.log('\nTransferring 5 Token A...');
    const txA = await transfer(
        connection,
        deployer,
        deployerTokenA.address,
        recipientTokenA.address,
        deployer,
        amount
    );
    console.log('Token A transfer TX:', txA);

    console.log('\nTransferring 5 Token B...');
    const txB = await transfer(
        connection,
        deployer,
        deployerTokenB.address,
        recipientTokenB.address,
        deployer,
        amount
    );
    console.log('Token B transfer TX:', txB);

    console.log('\n✅ Airdrop complete! Recipient now has 5 Token A and 5 Token B');
}

main().catch(console.error);
