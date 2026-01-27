/**
 * Token Holder Proof API
 * Proves token ownership >= minimum requirement.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    checkRequiredTools,
    writeProverToml,
    addressToField,
} from '@/lib/proof-utils';
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
    generateWitness,
    generateFullProof,
} from '@/lib/proof-generator';

const CIRCUIT_NAME = 'token_holder';

// -----------------------------------------------------------------------------
// POST - Generate Proof
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
    try {
        const { token_amount, user_address, token_mint, min_required } = await request.json();

        if (!token_amount || !user_address || !token_mint || !min_required) {
            return missingParamsError(['token_amount', 'user_address', 'token_mint', 'min_required']);
        }

        const tokenAmountNum = parseFloat(token_amount);
        const minRequiredNum = parseFloat(min_required);

        if (tokenAmountNum < minRequiredNum) {
            return createErrorResponse(
                ProofErrorCodes.INSUFFICIENT_HOLDINGS,
                'Insufficient token holdings',
                400,
                `Have ${token_amount}, need ${min_required}`
            );
        }

        const tools = await checkRequiredTools();
        if (!tools.allAvailable) {
            return toolsNotAvailableError(tools);
        }

        const config = createCircuitConfig(CIRCUIT_NAME);
        const userAddressField = addressToField(user_address);
        const tokenMintField = addressToField(token_mint);

        const proverContent = `token_amount = "${token_amount}"\nuser_address = "${userAddressField}"\ntoken_mint = "${tokenMintField}"\nmin_required = "${min_required}"`;
        await writeProverToml(config.circuitDir, proverContent);

        try {
            await generateWitness(config);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('assertion')) {
                return createErrorResponse(
                    ProofErrorCodes.INSUFFICIENT_HOLDINGS,
                    'Token holding verification failed',
                    400
                );
            }
            return witnessGenerationError(msg);
        }

        try {
            const result = await generateFullProof(config, { token_mint, min_required });
            return NextResponse.json(result);
        } catch (e) {
            return proofGenerationError(e instanceof Error ? e.message : String(e));
        }

    } catch (error) {
        return internalError(error instanceof Error ? error.message : 'Unknown');
    }
}

// -----------------------------------------------------------------------------
// GET - Health Check
// -----------------------------------------------------------------------------

export async function GET() {
    return NextResponse.json({
        circuit: CIRCUIT_NAME,
        description: 'Proves token ownership >= minimum (simplified for Sunspot compatibility)',
        inputs: { private: ['token_amount', 'user_address'], public: ['token_mint', 'min_required'] },
    });
}
