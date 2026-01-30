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

// Generate Proof

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

        // Generate dummy Merkle inputs for Demo
        // Corresponds to 'Trivial Hash' in circuit

        // 1. Account Data (165 bytes)
        const dummyAccountData = Array(165).fill(0).map(() => 0);

        // 2. Merkle Path (32 fields) & Indices
        const dummyMerklePath = Array(32).fill(0).map(() => 0);
        const dummyMerkleIndices = "0";

        // 3. Compute Expected Root
        // Leaf = Amount + Address + Mint
        // Root = Leaf + 32 (adding 1 for 32 levels)

        // Note: addressToField returns a string representation of the field element
        const amountBn = BigInt(token_amount); // Assuming integer amount for simplicity
        const addressBn = BigInt(userAddressField);
        const mintBn = BigInt(tokenMintField);

        // Leaf Hash = Amount + Address + Mint
        const leafHash = amountBn + addressBn + mintBn;

        // Root Hash = Leaf + 32
        const computedRoot = leafHash + BigInt(32);

        // Write Prover.toml with all required inputs
        const proverContent = `
# Private inputs
token_amount = "${token_amount}"
user_address = "${userAddressField}"
account_data = ${JSON.stringify(dummyAccountData)}
merkle_path = ${JSON.stringify(dummyMerklePath.map(x => x.toString()))}
merkle_indices = "${dummyMerkleIndices}"

# Public inputs
token_mint = "${tokenMintField}"
state_root = "${computedRoot.toString()}"
min_required = "${min_required}"
`.trim();

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

// Health Check

export async function GET() {
    return NextResponse.json({
        circuit: CIRCUIT_NAME,
        description: 'Proves token ownership >= minimum (simplified for Sunspot compatibility)',
        inputs: { private: ['token_amount', 'user_address'], public: ['token_mint', 'min_required'] },
    });
}
