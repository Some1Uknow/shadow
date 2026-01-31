
import { NextResponse } from 'next/server';
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getAccount,
    createMintToInstruction
} from '@solana/spl-token';
import fs from 'fs';
import path from 'path';

// helper to get deployer keypair
function getDeployerKeypair(): Keypair | null {
    // 1. try env var
    const envKey = process.env.FAUCET_PRIVATE_KEY;
    if (envKey) {
        try {
            const secretKey = Uint8Array.from(JSON.parse(envKey));
            return Keypair.fromSecretKey(secretKey);
        } catch (e) {
            console.error('Failed to parse FAUCET_PRIVATE_KEY', e);
        }
    }

    // 2. try local file
    try {
        // go up from app to repo root
        const deployerPath = path.join(process.cwd(), '..', 'deployer.json');
        if (fs.existsSync(deployerPath)) {
            const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(deployerPath, 'utf-8')));
            return Keypair.fromSecretKey(secretKey);
        }
    } catch (e) {
        console.error('Failed to load local deployer.json', e);
    }

    return null;
}

export async function POST(request: Request) {
    try {
        const { recipient, amountA, amountB } = await request.json();

        if (!recipient) {
            return NextResponse.json({ error: 'Recipient address required' }, { status: 400 });
        }

        const deployer = getDeployerKeypair();
        if (!deployer) {
            return NextResponse.json({ error: 'Faucet not configured (no keypair found)' }, { status: 500 });
        }

        const network = process.env.NEXT_PUBLIC_NETWORK || 'devnet';
        const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcEndpoint, 'confirmed');

        const recipientPubkey = new PublicKey(recipient);
        const tokenAMint = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_A_MINT!);
        const tokenBMint = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_B_MINT!);

        const tx = new Transaction();

        // helper to mint tokens to recipient and create ata if needed
        async function addMint(mint: PublicKey, amount: number) {
            if (amount <= 0) return;

            const decimals = 9; // assuming 9 decimals for now
            const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

            const recipientATA = await getAssociatedTokenAddress(mint, recipientPubkey);

            // check if recipient ata exists
            try {
                await getAccount(connection, recipientATA);
            } catch (e) {
                // ata does not exist, create it
                tx.add(
                    createAssociatedTokenAccountInstruction(
                        deployer!.publicKey, // payer
                        recipientATA,
                        recipientPubkey,
                        mint
                    )
                );
            }

            // mint directly to recipient
            tx.add(
                createMintToInstruction(
                    mint,
                    recipientATA,
                    deployer!.publicKey,
                    rawAmount
                )
            );
        }

        await addMint(tokenAMint, Number(amountA) || 0);
        await addMint(tokenBMint, Number(amountB) || 0);

        if (tx.instructions.length === 0) {
            return NextResponse.json({ message: 'No tokens requested' });
        }

        const signature = await sendAndConfirmTransaction(connection, tx, [deployer]);

        return NextResponse.json({
            success: true,
            signature,
            message: `Sent ${amountA} Token A and ${amountB} Token B`
        });

    } catch (error: any) {
        console.error('Faucet error:', error);
        return NextResponse.json({ error: error.message || 'Faucet failed' }, { status: 500 });
    }
}
