import { NextResponse } from 'next/server';
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    ComputeBudgetProgram,
} from '@solana/web3.js';
import { BorshCoder, type Idl } from '@coral-xyz/anchor';
import idl from '@/idl/zkgate.json';
import { createCircuitConfig, verifyProof } from '@/lib/proof-generator';

// Real Relayer Implementation
// Uses a backend hot wallet to sign and pay for user transactions (Gasless / Private)

function decodeNullifierHash(ixData: Buffer): { name: string; hash: Buffer } | null {
    try {
        const coder = new BorshCoder(idl as Idl);
        const decoded = coder.instruction.decode(ixData);
        if (decoded) {
            const raw =
                (decoded.data as Record<string, unknown>)['nullifier_hash'] ??
                (decoded.data as Record<string, unknown>)['nullifierHash'];
            if (raw instanceof Uint8Array || Array.isArray(raw) || Buffer.isBuffer(raw)) {
                return { name: decoded.name, hash: Buffer.from(raw as Uint8Array) };
            }
        }
    } catch {
        // Fall through to manual decode.
    }

    // Manual layout: discriminator (8) + proof (u32 + bytes) + public_inputs (u32 + bytes)
    // + amount_in (u64) + min_out (u64) + is_a_to_b (bool) + nullifier_hash ([u8;32])
    try {
        let offset = 8;
        if (ixData.length < offset + 4) return null;
        const proofLen = ixData.readUInt32LE(offset);
        offset += 4 + proofLen;
        if (ixData.length < offset + 4) return null;
        const publicLen = ixData.readUInt32LE(offset);
        offset += 4 + publicLen;
        if (ixData.length < offset + 8 + 8 + 1 + 32) return null;
        offset += 8; // amount_in
        offset += 8; // min_out
        offset += 1; // is_a_to_b
        const hash = ixData.slice(offset, offset + 32);
        if (hash.length !== 32) return null;
        return { name: 'swap_private', hash };
    } catch {
        return null;
    }
}

function decodeProofAndPublic(ixData: Buffer): { proof?: Buffer; publicInputs?: Buffer } {
    try {
        const coder = new BorshCoder(idl as Idl);
        const decoded = coder.instruction.decode(ixData);
        if (decoded) {
            const data = decoded.data as Record<string, unknown>;
            const proofRaw = data['proof'] ?? data['zk_proof'];
            const publicRaw = data['public_inputs'] ?? data['publicInputs'];
            const proof =
                proofRaw instanceof Uint8Array || Array.isArray(proofRaw) || Buffer.isBuffer(proofRaw)
                    ? Buffer.from(proofRaw as Uint8Array)
                    : undefined;
            const publicInputs =
                publicRaw instanceof Uint8Array || Array.isArray(publicRaw) || Buffer.isBuffer(publicRaw)
                    ? Buffer.from(publicRaw as Uint8Array)
                    : undefined;
            return { proof, publicInputs };
        }
    } catch {
        // fall through to manual decode
    }

    try {
        let offset = 8; // discriminator
        if (ixData.length < offset + 4) return {};
        const proofLen = ixData.readUInt32LE(offset);
        offset += 4;
        const proof = ixData.slice(offset, offset + proofLen);
        offset += proofLen;
        if (ixData.length < offset + 4) return { proof };
        const publicLen = ixData.readUInt32LE(offset);
        offset += 4;
        const publicInputs = ixData.slice(offset, offset + publicLen);
        return { proof, publicInputs };
    } catch {
        return {};
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { proof, publicInputs, instructionData, accounts, eligibilityProofs, requireEligibility } = body;

        if (!proof || !publicInputs || !instructionData || !accounts) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        if (requireEligibility && (!eligibilityProofs || eligibilityProofs.length === 0)) {
            return NextResponse.json({ success: false, error: 'Eligibility proofs required' }, { status: 400 });
        }

        if (Array.isArray(eligibilityProofs) && eligibilityProofs.length > 0) {
            for (const entry of eligibilityProofs) {
                const circuitName =
                    entry.type === 'min_balance'
                        ? 'min_balance'
                        : entry.type === 'token_holder'
                            ? 'token_holder'
                            : entry.type === 'exclusion'
                                ? 'smt_exclusion'
                                : null;
                if (!circuitName || !entry.proof) {
                    return NextResponse.json({ success: false, error: 'Invalid eligibility proof' }, { status: 400 });
                }
                const config = createCircuitConfig(circuitName);
                try {
                    await verifyProof(
                        config,
                        new Uint8Array(entry.proof),
                        new Uint8Array(entry.publicInputs)
                    );
                } catch (e) {
                    return NextResponse.json({
                        success: false,
                        error: e instanceof Error ? e.message : 'Eligibility proof verification failed',
                    }, { status: 400 });
                }
            }
        }

        console.log('--- RELAYER RECEIVED REQUEST ---');
        console.log('Submitting REAL transaction to Solana Devnet via Web3.js...');

        // 1. Setup Connection & Wallet
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');

        const relayerKeyString = process.env.RELAYER_PRIVATE_KEY;
        if (!relayerKeyString) {
            throw new Error('Relayer Private Key not configured on server');
        }

        let secretKey: Uint8Array;
        try {
            secretKey = new Uint8Array(JSON.parse(relayerKeyString));
        } catch (e) {
            throw new Error('Failed to parse RELAYER_PRIVATE_KEY. Ensure it is a JSON array of numbers.');
        }

        const relayerKeypair = Keypair.fromSecretKey(secretKey);

        console.log('Relayer Address:', relayerKeypair.publicKey.toBase58());

        // 2. Reconstruct Instruction
        // We use pure web3.js TransactionInstruction to avoid Anchor imports (which caused build errors)

        const ixData = Buffer.from(instructionData, 'base64');
        const decodedProof = decodeProofAndPublic(ixData);
        const requestProof = Array.isArray(proof) ? Buffer.from(proof) : null;
        const requestPublic = Array.isArray(publicInputs) ? Buffer.from(publicInputs) : null;
        const decodedNullifier = decodeNullifierHash(ixData);
        let nullifierFromPublic: Buffer | null = null;
        if (Array.isArray(publicInputs) && publicInputs.length >= 64) {
            const headerOffset = publicInputs.length % 32 === 12 ? 12 : 0;
            nullifierFromPublic = Buffer.from(publicInputs.slice(headerOffset + 32, headerOffset + 64));
        }
        const nullifierHash = decodedNullifier?.hash ?? nullifierFromPublic;
        if (!nullifierHash) {
            throw new Error('Unable to decode nullifier hash');
        }
        const [nullifierPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('nullifier'),
                new PublicKey(accounts.inputShieldedPool).toBuffer(),
                nullifierHash,
            ],
            new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!)
        );
        const [nullifierPdaAlt] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('nullifier'),
                new PublicKey(accounts.inputShieldedPool).toBuffer(),
                Buffer.from(nullifierHash).reverse(),
            ],
            new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!)
        );
        const providedNullifierPda = accounts.nullifierAccount
            ? new PublicKey(accounts.nullifierAccount)
            : null;
        const nullifierPdaToUse = providedNullifierPda ?? nullifierPda;
        const debugInfo = {
            inputShieldedPool: accounts.inputShieldedPool,
            programId: process.env.NEXT_PUBLIC_PROGRAM_ID,
            nullifierHashHex: nullifierHash.toString('hex'),
            nullifierFromPublicHex: nullifierFromPublic?.toString('hex') || null,
            nullifierFromIxHex: decodedNullifier?.hash?.toString('hex') || null,
            decodedIxName: decodedNullifier?.name || null,
            derivedNullifierPda: nullifierPda.toBase58(),
            derivedNullifierPdaAlt: nullifierPdaAlt.toBase58(),
            providedNullifierPda: accounts.nullifierAccount || null,
            usingProvidedNullifierPda: providedNullifierPda ? true : false,
            proofLen: decodedProof.proof?.length ?? null,
            publicInputsLen: decodedProof.publicInputs?.length ?? null,
            proofCommitments: decodedProof.proof && decodedProof.proof.length >= 260
                ? decodedProof.proof.readUInt32BE(256)
                : null,
            requestProofLen: requestProof?.length ?? null,
            requestPublicLen: requestPublic?.length ?? null,
            proofPrefix: decodedProof.proof?.subarray(0, 8)?.toString('hex') ?? null,
            requestProofPrefix: requestProof?.subarray(0, 8)?.toString('hex') ?? null,
        };

        const instruction = new TransactionInstruction({
            programId: new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
            keys: [
                { pubkey: new PublicKey(accounts.pool), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(accounts.inputShieldedPool), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(accounts.inputRootHistory), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(accounts.verifierProgram), isSigner: false, isWritable: false },
                { pubkey: nullifierPdaToUse, isSigner: false, isWritable: true },
                { pubkey: relayerKeypair.publicKey, isSigner: true, isWritable: true }, // The Relayer pays!
                { pubkey: new PublicKey(accounts.tokenProgram), isSigner: false, isWritable: false },
                { pubkey: new PublicKey(accounts.systemProgram), isSigner: false, isWritable: false },
                // Remaining accounts (order matters)
                { pubkey: new PublicKey(accounts.shieldedVaultIn), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(accounts.reserveIn), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(accounts.reserveOut), isSigner: false, isWritable: true },
                { pubkey: new PublicKey(accounts.recipientToken), isSigner: false, isWritable: true },
            ],
            data: ixData
        });

        // 3. Create, simulate, and send transaction
        // Add generous compute + priority so the gnark verifier CPI doesn't exhaust budget
        const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
        const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }); // ~1 lamport/cu

        const tx = new Transaction().add(computeBudgetIx, priorityIx, instruction);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = relayerKeypair.publicKey;
        tx.sign(relayerKeypair);

        const simulation = await connection.simulateTransaction(tx);

        if (simulation.value.err) {
            console.error('Relayer simulation error:', simulation.value.err, simulation.value.logs, debugInfo);
            return NextResponse.json({
                success: false,
                error: 'Simulation failed',
                details: simulation.value.err,
                logs: simulation.value.logs || [],
                debug: debugInfo,
            }, { status: 500 });
        }

        const signature = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
        });
        await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
        }, 'confirmed');

        console.log('Transaction Success! Signature:', signature);

        return NextResponse.json({
            success: true,
            signature: signature,
        });

    } catch (error) {
        console.error('Relayer Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 500 });
    }
}
