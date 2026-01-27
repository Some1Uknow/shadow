/**
 * Min Balance Proof API
 * Generates a ZK proof that balance >= threshold without revealing actual balance.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    checkRequiredTools,
    writeProverToml,
} from '@/lib/proof-utils';
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

// -----------------------------------------------------------------------------
// POST - Generate Proof
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { balance, threshold } = body;

        // Validate required parameters
        if (balance === undefined || balance === null || threshold === undefined || threshold === null) {
            return createErrorResponse(
                ProofErrorCodes.MISSING_PARAMS,
                'Missing required parameters: balance and threshold',
                400,
                'Both balance and threshold must be provided as strings representing token amounts in smallest units (e.g., lamports)'
            );
        }

        // Validate balance is a valid number
        const balanceNum = BigInt(balance);
        const thresholdNum = BigInt(threshold);

        if (balanceNum < BigInt(0)) {
            return createErrorResponse(
                ProofErrorCodes.INVALID_BALANCE,
                'Invalid balance: must be non-negative',
                400,
                `Received balance: ${balance}`
            );
        }

        // Pre-check: balance must be >= threshold
        if (balanceNum < thresholdNum) {
            return createErrorResponse(
                ProofErrorCodes.BALANCE_BELOW_THRESHOLD,
                'Insufficient balance for swap',
                400,
                `Your balance (${balanceNum.toString()}) is below the required threshold (${thresholdNum.toString()}). You need at least ${thresholdNum.toString()} tokens to proceed.`
            );
        }

        console.log('[Prove API] Generating proof for:', { balance, threshold });

        // Check required tools
        const tools = await checkRequiredTools();
        if (!tools.allAvailable) {
            return toolsNotAvailableError(tools);
        }

        // Check if circuit is compiled
        const config = createCircuitConfig(CIRCUIT_NAME);
        if (!await isCircuitCompiled(config)) {
            return circuitNotCompiledError(CIRCUIT_NAME);
        }

        // Write Prover.toml with inputs
        const proverContent = `# Private inputs\nbalance = "${balance}"\n\n# Public inputs\nthreshold = "${threshold}"`;
        await writeProverToml(config.circuitDir, proverContent);
        console.log('[Prove API] Written Prover.toml');

        // Generate witness
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

        // Verify witness was generated
        if (!await isWitnessGenerated(config)) {
            return witnessGenerationError('nargo execute completed but witness file was not created');
        }
        console.log('[Prove API] Witness generated');

        // Generate proof
        console.log('[Prove API] Running sunspot prove...');
        try {
            const result = await generateFullProof(config, {
                threshold,
                proofSize: 0, // Will be updated below
                publicInputsSize: 0,
            });

            // Update metadata with actual sizes
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

// -----------------------------------------------------------------------------
// GET - Health Check
// -----------------------------------------------------------------------------

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
            private: ['balance'],
            public: ['threshold'],
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
