/*
 * shielded tree helper
 * stores commitments locally and serves merkle paths
 * production should move this to a real sequencer + db
 */

import { NextRequest, NextResponse } from 'next/server';
import { insertCommitment, getMerklePath, getTreeRoot } from '@/lib/shielded-tree';
import { fieldToBeBytes32 } from '@/lib/proof-utils';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { BorshCoder, type Idl } from '@coral-xyz/anchor';
import idl from '@/idl/zkgate.json';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const { commitment, pool_id } = await req.json();
        if (!commitment || !pool_id) {
            return NextResponse.json({ success: false, error: 'Missing commitment' }, { status: 400 });
        }
        const { index, root } = await insertCommitment(pool_id, commitment);

        // optional: update on-chain root via relayer authority
        const programId = process.env.NEXT_PUBLIC_PROGRAM_ID;
        const rootAuthorityEnv = process.env.ROOT_AUTHORITY_PRIVATE_KEY;
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com';

        let rootUpdate: { signature: string; includedLeaves: string; onchainNextIndex: string | null } | null = null;
        let authorityUsed: string | null = null;

        if (programId) {
            const connection = new Connection(rpcUrl, 'confirmed');
            let authority: Keypair | null = null;

            if (rootAuthorityEnv) {
                try {
                    const secret = new Uint8Array(JSON.parse(rootAuthorityEnv));
                    authority = Keypair.fromSecretKey(secret);
                    authorityUsed = 'ROOT_AUTHORITY_PRIVATE_KEY';
                } catch {
                    // fall through to deployer.json
                }
            }

            if (!authority) {
                const deployerPath = path.join(process.cwd(), '..', 'deployer.json');
                if (fs.existsSync(deployerPath)) {
                    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(deployerPath, 'utf-8')));
                    authority = Keypair.fromSecretKey(secret);
                    authorityUsed = 'deployer.json';
                }
            }

            if (!authority) {
                const relayerKey = process.env.RELAYER_PRIVATE_KEY;
                if (relayerKey) {
                    const secret = new Uint8Array(JSON.parse(relayerKey));
                    authority = Keypair.fromSecretKey(secret);
                    authorityUsed = 'RELAYER_PRIVATE_KEY';
                }
            }

            if (!authority) {
                throw new Error('Root authority key not configured (set ROOT_AUTHORITY_PRIVATE_KEY or deployer.json)');
            }
            const shieldedPool = new PublicKey(pool_id);
            const rootHistory = PublicKey.findProgramAddressSync(
                [Buffer.from('shielded_root'), shieldedPool.toBuffer()],
                new PublicKey(programId)
            )[0];

            const discriminator = crypto
                .createHash('sha256')
                .update('global:update_shielded_root')
                .digest()
                .subarray(0, 8);

            // root is a field element; gnark witness uses big-endian encoding
            const rootBytes = Buffer.from(fieldToBeBytes32(root));
            const includedLeaves = Buffer.alloc(8);

            // use on-chain next_index so the root update passes the program constraint
            let includedLeavesValue = BigInt(index + 1);
            let onchainNextIndex: string | null = null;
            try {
                const info = await connection.getAccountInfo(shieldedPool);
                if (info?.data) {
                    const coder = new BorshCoder(idl as Idl);
                    const decoded = coder.accounts.decode('ShieldedPool', info.data) as Record<string, unknown>;
                    const nextIndex =
                        (decoded.nextIndex as { toString?: () => string } | undefined) ??
                        (decoded.next_index as { toString?: () => string } | undefined);
                    if (nextIndex?.toString) {
                        const nextIndexStr = nextIndex.toString();
                        onchainNextIndex = nextIndexStr;
                        includedLeavesValue = BigInt(nextIndexStr);
                    }
                }
            } catch {
                // fall back to local index when decode fails
            }

            includedLeaves.writeBigUInt64LE(includedLeavesValue);

            const data = Buffer.concat([discriminator, rootBytes, includedLeaves]);

            const ix = new TransactionInstruction({
                programId: new PublicKey(programId),
                keys: [
                    { pubkey: shieldedPool, isSigner: false, isWritable: true },
                    { pubkey: rootHistory, isSigner: false, isWritable: true },
                    { pubkey: authority.publicKey, isSigner: true, isWritable: false },
                ],
                data,
            });

            const tx = new Transaction().add(ix);
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = authority.publicKey;

            const sig = await connection.sendTransaction(tx, [authority], { skipPreflight: true });
            const confirmation = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
            if (confirmation.value.err) {
                throw new Error(`Root update failed: ${JSON.stringify(confirmation.value.err)}`);
            }
            rootUpdate = {
                signature: sig,
                includedLeaves: includedLeavesValue.toString(),
                onchainNextIndex,
            };
        }

        return NextResponse.json({ success: true, index, root, rootUpdate, authorityUsed });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown';
        console.error('shielded tree error:', message, e);
        return NextResponse.json({
            success: false,
            error: message,
        }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const indexParam = searchParams.get('index');
        const poolId = searchParams.get('pool_id');
        if (!poolId) {
            return NextResponse.json({ success: false, error: 'Missing pool_id' }, { status: 400 });
        }
        if (!indexParam) {
            const root = await getTreeRoot(poolId);
            return NextResponse.json({ success: true, root });
        }
        const index = Number(indexParam);
        const { path, indices, root } = await getMerklePath(poolId, index);
        return NextResponse.json({ success: true, path, indices, root });
    } catch (e) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
    }
}
