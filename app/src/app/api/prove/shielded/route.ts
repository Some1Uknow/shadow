/*
 * shielded spend proof api
 * proves note ownership and binds recipient, amount, mint, and pool
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    checkRequiredTools,
    writeProverToml,
    addressToField,
} from '@/lib/proof-utils';
import { poseidonHash } from '@/lib/poseidon';
import {
    ProofErrorCodes,
    createErrorResponse,
    missingParamsError,
    toolsNotAvailableError,
    witnessGenerationError,
    proofGenerationError,
    internalError,
} from '@/lib/proof-errors';
import {
    createCircuitConfig,
    isCircuitCompiled,
    generateWitness,
    isWitnessGenerated,
    generateFullProof,
} from '@/lib/proof-generator';

const CIRCUIT_NAME = 'shielded_spend';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            amount,
            secret,
            nullifier,
            merkle_path,
            merkle_indices,
            root,
            recipient,
            mint,
            pool_id,
        } = body;

        if (
            amount === undefined ||
            secret === undefined ||
            nullifier === undefined ||
            !merkle_path ||
            !merkle_indices ||
            !root ||
            !recipient ||
            !mint ||
            !pool_id
        ) {
            return missingParamsError([
                'amount',
                'secret',
                'nullifier',
                'merkle_path',
                'merkle_indices',
                'root',
                'recipient',
                'mint',
                'pool_id',
            ]);
        }

        const tools = await checkRequiredTools();
        if (!tools.allAvailable) {
            return toolsNotAvailableError(tools);
        }

        const config = createCircuitConfig(CIRCUIT_NAME);
        if (!await isCircuitCompiled(config)) {
            return createErrorResponse(
                ProofErrorCodes.CIRCUIT_NOT_COMPILED,
                `Circuit ${CIRCUIT_NAME} not compiled`,
                500
            );
        }

        const recipientField = addressToField(recipient);
        const mintField = addressToField(mint);
        const poolField = addressToField(pool_id);

        const nullifierHash = await poseidonHash([nullifier, mintField, poolField]);

        const proverContent = `
# Private inputs
amount = "${amount}"
secret = "${secret}"
nullifier = "${nullifier}"
merkle_path = ${JSON.stringify(merkle_path.map((x: string | number) => x.toString()))}
merkle_indices = ${JSON.stringify(merkle_indices)}

# Public inputs
root = "${root}"
nullifier_hash = "${nullifierHash}"
amount_pub = "${amount}"
recipient = "${recipientField}"
mint = "${mintField}"
pool_id = "${poolField}"
`.trim();

        await writeProverToml(config.circuitDir, proverContent);

        try {
            await generateWitness(config);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return witnessGenerationError(msg);
        }

        if (!await isWitnessGenerated(config)) {
            return witnessGenerationError('nargo execute completed but witness file was not created');
        }

        try {
            const result = await generateFullProof(config, {
                amount,
                recipient,
                mint,
                pool_id,
            });
            return NextResponse.json(result);
        } catch (e) {
            return proofGenerationError(e instanceof Error ? e.message : String(e));
        }

    } catch (error) {
        return internalError(error instanceof Error ? error.message : 'Unknown');
    }
}

export async function GET() {
    return NextResponse.json({
        circuit: CIRCUIT_NAME,
        description: 'Shielded spend proof (note membership + nullifier + recipient binding)',
        inputs: {
            private: ['amount', 'secret', 'nullifier', 'merkle_path', 'merkle_indices'],
            public: ['root', 'nullifier_hash', 'amount_pub', 'recipient', 'mint', 'pool_id'],
        },
    });
}
