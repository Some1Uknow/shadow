/*
 * token holder proof api
 * proves token ownership >= minimum requirement
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
    checkRequiredTools,
    writeProverToml,
    addressToField,
} from '@/lib/proof-utils';
import { hashAccountData, readU64Le } from '@/lib/account-hash';
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

export async function POST(request: NextRequest) {
    try {
        const { token_amount, user_address, token_mint, min_required } = await request.json();

        if (!token_amount || !user_address || !token_mint || !min_required) {
            return missingParamsError(['token_amount', 'user_address', 'token_mint', 'min_required']);
        }

        const minRequiredBase = BigInt(min_required);

        const tools = await checkRequiredTools();
        if (!tools.allAvailable) {
            return toolsNotAvailableError(tools);
        }

        const config = createCircuitConfig(CIRCUIT_NAME);
        const userAddressField = addressToField(user_address);
        const tokenMintField = addressToField(token_mint);

        const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcEndpoint, 'confirmed');
        const ownerKey = new PublicKey(user_address);
        const mintKey = new PublicKey(token_mint);
        const ata = await getAssociatedTokenAddress(mintKey, ownerKey);
        const accountInfo = await connection.getAccountInfo(ata);
        if (!accountInfo?.data) {
            return createErrorResponse(
                ProofErrorCodes.INSUFFICIENT_HOLDINGS,
                'Token account not found',
                404
            );
        }
        const accountData = new Uint8Array(accountInfo.data);
        if (accountData.length < 165) {
            return createErrorResponse(
                ProofErrorCodes.INSUFFICIENT_HOLDINGS,
                'Invalid token account data',
                400
            );
        }
        const amountBn = BigInt(readU64Le(accountData, 64));
        if (amountBn < minRequiredBase) {
            return createErrorResponse(
                ProofErrorCodes.INSUFFICIENT_HOLDINGS,
                'Insufficient token holdings',
                400,
                `Have ${amountBn.toString()}, need ${min_required}`
            );
        }

        const computedRoot = hashAccountData(accountData);

        const proverContent = `
# Private inputs
token_amount = "${amountBn.toString()}"
user_address = "${userAddressField}"
account_data = ${JSON.stringify(Array.from(accountData))}

# Public inputs
token_mint = "${tokenMintField}"
state_root = "${computedRoot}"
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

export async function GET() {
    return NextResponse.json({
        circuit: CIRCUIT_NAME,
        description: 'Proves token ownership >= minimum',
        inputs: { private: ['token_amount', 'user_address', 'account_data'], public: ['token_mint', 'state_root', 'min_required'] },
    });
}
