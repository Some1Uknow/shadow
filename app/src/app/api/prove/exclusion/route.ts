/*
 * smt exclusion proof api
 * proves an address is not on a blacklist
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    checkRequiredTools,
    writeProverToml,
    addressToField,
    generateAddressHash,
} from '@/lib/proof-utils';
import {
    ProofErrorCodes,
    createErrorResponse,
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

const CIRCUIT_NAME = 'smt_exclusion';

export async function POST(request: NextRequest) {
    try {
        const { address, blacklist_root = '0' } = await request.json();

        if (!address) {
            return createErrorResponse(
                ProofErrorCodes.MISSING_PARAMS,
                'Missing address',
                400
            );
        }

        const tools = await checkRequiredTools();
        if (!tools.allAvailable) {
            return toolsNotAvailableError(tools);
        }

        const config = createCircuitConfig(CIRCUIT_NAME);
        const addressField = addressToField(address);
        const addressHash = generateAddressHash(addressField);

        const proverContent = `address = "${addressField}"\naddress_hash = "${addressHash}"\nblacklist_root = "${blacklist_root}"`;
        await writeProverToml(config.circuitDir, proverContent);

        try {
            await generateWitness(config);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('assertion')) {
                return createErrorResponse(
                    ProofErrorCodes.ADDRESS_BLACKLISTED,
                    'Address may be blacklisted',
                    400
                );
            }
            return witnessGenerationError(msg);
        }

        try {
            const result = await generateFullProof(config);
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
        description: 'Proves address is NOT on a blacklist',
        inputs: { private: ['address', 'address_hash'], public: ['blacklist_root'] },
    });
}

export async function PUT(request: NextRequest) {
    const { address } = await request.json();

    if (!address) {
        return createErrorResponse(
            ProofErrorCodes.MISSING_PARAMS,
            'Missing address',
            400
        );
    }

    const addressField = addressToField(address);

    return NextResponse.json({
        success: true,
        inputs: {
            address: addressField,
            address_hash: generateAddressHash(addressField),
            blacklist_root: '0',
        },
    });
}
