/*
 * min balance proof api
 * proves balance >= threshold without revealing the exact balance
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
    toolsNotAvailableError,
    circuitNotCompiledError,
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

const CIRCUIT_NAME = 'min_balance';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { owner, token_mint, threshold } = body;

        if (!owner || !token_mint || threshold === undefined || threshold === null) {
            return createErrorResponse(
                ProofErrorCodes.MISSING_PARAMS,
                'Missing required parameters: owner, token_mint, threshold',
                400,
                'owner, token_mint, and threshold are required'
            );
        }

        const thresholdNum = BigInt(threshold);

        if (thresholdNum < BigInt(0)) {
            return createErrorResponse(
                ProofErrorCodes.INVALID_BALANCE,
                'Invalid balance: must be non-negative',
                400,
                `Received threshold: ${threshold}`
            );
        }

        const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcEndpoint, 'confirmed');
        const ownerKey = new PublicKey(owner);
        const mintKey = new PublicKey(token_mint);
        const ata = await getAssociatedTokenAddress(mintKey, ownerKey);
        const accountInfo = await connection.getAccountInfo(ata);
        if (!accountInfo?.data) {
            return createErrorResponse(
                ProofErrorCodes.INVALID_BALANCE,
                'Token account not found',
                404
            );
        }
        const accountData = new Uint8Array(accountInfo.data);
        if (accountData.length < 165) {
            return createErrorResponse(
                ProofErrorCodes.INVALID_BALANCE,
                'Invalid token account data',
                400
            );
        }
        const balanceNum = BigInt(readU64Le(accountData, 64));

        if (balanceNum < thresholdNum) {
            return createErrorResponse(
                ProofErrorCodes.BALANCE_BELOW_THRESHOLD,
                'Insufficient balance for swap',
                400,
                `Your balance (${balanceNum.toString()}) is below the required threshold (${thresholdNum.toString()}). You need at least ${thresholdNum.toString()} tokens to proceed.`
            );
        }

        const balance = balanceNum.toString();
        const ownerField = addressToField(owner);
        const tokenMintField = addressToField(token_mint);
        const computedRoot = hashAccountData(accountData);

        console.log('[Prove API] Generating proof for:', { owner, token_mint, threshold });

        const tools = await checkRequiredTools();
        if (!tools.allAvailable) {
            return toolsNotAvailableError(tools);
        }

        const config = createCircuitConfig(CIRCUIT_NAME);
        if (!await isCircuitCompiled(config)) {
            return circuitNotCompiledError(CIRCUIT_NAME);
        }

        const proverContent = `
# Private inputs
balance = "${balance}"
owner = "${ownerField}"
account_data = ${JSON.stringify(Array.from(accountData))}

# Public inputs
state_root = "${computedRoot}"
threshold = "${threshold}"
token_mint = "${tokenMintField}"
`.trim();

        await writeProverToml(config.circuitDir, proverContent);
        console.log('[Prove API] Written Prover.toml with inputs');

        console.log('[Prove API] Running nargo execute...');
        try {
            await generateWitness(config);
        } catch (execError) {
            const errorMsg = execError instanceof Error ? execError.message : String(execError);
            console.error('[Prove API] nargo execute failed:', errorMsg);

            if (errorMsg.includes('assertion') || errorMsg.includes('failed')) {
                return createErrorResponse(
                    ProofErrorCodes.BALANCE_BELOW_THRESHOLD,
                    'Balance verification failed',
                    400,
                    'The circuit assertion failed. This usually means your balance is below the required threshold.'
                );
            }

            return witnessGenerationError(errorMsg);
        }

        if (!await isWitnessGenerated(config)) {
            return witnessGenerationError('nargo execute completed but witness file was not created');
        }
        console.log('[Prove API] Witness generated');

        console.log('[Prove API] Running sunspot prove...');
        try {
            const result = await generateFullProof(config, {
                threshold,
                proofSize: 0, // will be updated below
                publicInputsSize: 0,
            });

            result.metadata = {
                threshold,
                proofSize: result.proof.length,
                publicInputsSize: result.publicInputs.length,
            };

            console.log('[Prove API] Proof generated successfully!');
            console.log('[Prove API] Proof size:', result.proof.length, 'bytes');
            console.log('[Prove API] Public witness size:', result.publicInputs.length, 'bytes');

            return NextResponse.json(result);
        } catch (proveError) {
            const errorMsg = proveError instanceof Error ? proveError.message : String(proveError);
            console.error('[Prove API] sunspot prove failed:', errorMsg);
            return proofGenerationError(`sunspot prove failed: ${errorMsg}`);
        }

    } catch (error: unknown) {
        console.error('[Prove API] Unexpected error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return internalError(message);
    }
}

export async function GET() {
    const config = createCircuitConfig(CIRCUIT_NAME);
    const [isCompiled, tools] = await Promise.all([
        isCircuitCompiled(config),
        checkRequiredTools(),
    ]);

    const isReady = tools.allAvailable && isCompiled;

    return NextResponse.json({
        status: isReady ? 'ready' : 'setup_required',
        message: 'Min Balance Proof API',
        circuit: CIRCUIT_NAME,
        isCompiled,
        tools,
        description: 'Proves balance >= threshold without revealing actual balance',
        inputs: {
            private: ['balance', 'owner', 'account_data'],
            public: ['state_root', 'threshold', 'token_mint'],
        },
        ...((!isReady) && {
            setupInstructions: {
                nargo: !tools.nargo ? 'curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash && noirup -v 1.0.0-beta.1' : null,
                sunspot: !tools.sunspot ? 'git clone https://github.com/reilabs/sunspot.git && cd sunspot/go && go build -o sunspot . && sudo mv sunspot /usr/local/bin/' : null,
                compile: !isCompiled ? 'cd circuits/min_balance && nargo compile' : null,
            },
        }),
    });
}
