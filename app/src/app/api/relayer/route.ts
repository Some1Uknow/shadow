import { NextResponse } from 'next/server';
import {
    Connection,
    Transaction,
    ComputeBudgetProgram,
} from '@solana/web3.js';
import {
    parseRequestBody,
    verifyEligibility,
    getRelayerKeypair,
    buildNullifierMeta,
    buildDebugInfo,
    buildInstruction,
} from './utils';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = parseRequestBody(body);
        if (!parsed.ok) {
            return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
        }
        const { proof, publicInputs, instructionData, accounts, eligibilityProofs } = parsed;
        try {
            await verifyEligibility(eligibilityProofs);
        } catch (e) {
            return NextResponse.json({
                success: false,
                error: e instanceof Error ? e.message : 'Eligibility proof verification failed',
            }, { status: 400 });
        }

        // setup connection + relayer
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        const relayerKeypair = getRelayerKeypair();

        // build instruction + nullifier
        const ixData = Buffer.from(instructionData, 'base64');
        const requestProof = Array.isArray(proof) ? Buffer.from(proof) : null;
        const requestPublic = Array.isArray(publicInputs) ? Buffer.from(publicInputs) : null;
        const meta = buildNullifierMeta(ixData, publicInputs, accounts);
        const debugInfo = buildDebugInfo(meta, accounts, requestProof, requestPublic);
        const instruction = buildInstruction(ixData, accounts, relayerKeypair, meta.nullifierPdaToUse);

        // build tx w/ extra compute
        const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
        const priorityIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }); // ~1 lamport/cu
        const tx = new Transaction().add(computeBudgetIx, priorityIx, instruction);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = relayerKeypair.publicKey;
        tx.sign(relayerKeypair);
        const sent = await simulateAndSend(connection, tx, debugInfo);
        if (!sent.ok) return sent.response;

        return NextResponse.json({
            success: true,
            signature: sent.signature,
        });

    } catch (error) {
        console.error('Relayer Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 500 });
    }
}

async function simulateAndSend(connection: Connection, tx: Transaction, debugInfo: any) {
    const simulation = await connection.simulateTransaction(tx);
    if (simulation.value.err) {
        console.error('Relayer simulation error:', simulation.value.err, simulation.value.logs, debugInfo);
        return {
            ok: false as const,
            response: NextResponse.json({
                success: false,
                error: 'Simulation failed',
                details: simulation.value.err,
                logs: simulation.value.logs || [],
                debug: debugInfo,
            }, { status: 500 })
        };
    }
    const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
    });
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return { ok: true as const, signature };
}
