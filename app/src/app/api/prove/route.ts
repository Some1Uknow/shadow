import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Path to circuit directory (relative to project root)
const PROJECT_ROOT = path.join(process.cwd(), '..');
const CIRCUIT_DIR = path.join(PROJECT_ROOT, 'circuits', 'min_balance');
const TARGET_DIR = path.join(CIRCUIT_DIR, 'target');

/**
 * Error codes for better client-side handling
 */
const ErrorCodes = {
    MISSING_PARAMS: 'MISSING_PARAMS',
    INVALID_BALANCE: 'INVALID_BALANCE',
    BALANCE_BELOW_THRESHOLD: 'BALANCE_BELOW_THRESHOLD',
    NARGO_NOT_FOUND: 'NARGO_NOT_FOUND',
    SUNSPOT_NOT_FOUND: 'SUNSPOT_NOT_FOUND',
    CIRCUIT_NOT_COMPILED: 'CIRCUIT_NOT_COMPILED',
    WITNESS_GENERATION_FAILED: 'WITNESS_GENERATION_FAILED',
    PROOF_GENERATION_FAILED: 'PROOF_GENERATION_FAILED',
    SETUP_REQUIRED: 'SETUP_REQUIRED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Check if a command exists in PATH
 */
async function commandExists(cmd: string): Promise<boolean> {
    try {
        await execAsync(`which ${cmd}`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Min Balance Proof API
 * 
 * Generates a ZK proof that balance >= threshold without revealing the actual balance.
 * 
 * Request body:
 * - balance: string (in smallest units, e.g., lamports)
 * - threshold: string (in smallest units)
 * 
 * Response:
 * - success: boolean
 * - proof: number[] (Groth16 proof bytes)
 * - publicInputs: number[] (public witness bytes)
 * - error?: string (human-readable error message)
 * - errorCode?: string (machine-readable error code)
 * - details?: string (additional error context)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { balance, threshold } = body;

        // Validate required parameters
        if (balance === undefined || balance === null || threshold === undefined || threshold === null) {
            return NextResponse.json(
                { 
                    error: 'Missing required parameters: balance and threshold',
                    errorCode: ErrorCodes.MISSING_PARAMS,
                    details: 'Both balance and threshold must be provided as strings representing token amounts in smallest units (e.g., lamports)'
                },
                { status: 400 }
            );
        }

        // Validate balance is a valid number
        const balanceNum = BigInt(balance);
        const thresholdNum = BigInt(threshold);

        if (balanceNum < BigInt(0)) {
            return NextResponse.json(
                { 
                    error: 'Invalid balance: must be non-negative',
                    errorCode: ErrorCodes.INVALID_BALANCE,
                    details: `Received balance: ${balance}`
                },
                { status: 400 }
            );
        }

        // Pre-check: balance must be >= threshold (circuit will fail anyway, but better UX)
        if (balanceNum < thresholdNum) {
            return NextResponse.json(
                { 
                    error: 'Insufficient balance for swap',
                    errorCode: ErrorCodes.BALANCE_BELOW_THRESHOLD,
                    details: `Your balance (${balanceNum.toString()}) is below the required threshold (${thresholdNum.toString()}). You need at least ${thresholdNum.toString()} tokens to proceed.`
                },
                { status: 400 }
            );
        }

        console.log('[Prove API] Generating proof for:', { balance, threshold });

        // Check if nargo is available
        if (!await commandExists('nargo')) {
            return NextResponse.json(
                { 
                    error: 'Noir compiler (nargo) not found',
                    errorCode: ErrorCodes.NARGO_NOT_FOUND,
                    details: 'Please install nargo: curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash && noirup -v 1.0.0-beta.1'
                },
                { status: 500 }
            );
        }

        // Check if sunspot is available
        if (!await commandExists('sunspot')) {
            return NextResponse.json(
                { 
                    error: 'Sunspot prover not found',
                    errorCode: ErrorCodes.SUNSPOT_NOT_FOUND,
                    details: 'Please install sunspot: git clone https://github.com/reilabs/sunspot.git && cd sunspot/go && go build -o sunspot . && sudo mv sunspot /usr/local/bin/'
                },
                { status: 500 }
            );
        }

        // Check if circuit is compiled
        const circuitJsonPath = path.join(TARGET_DIR, 'min_balance.json');
        try {
            await fs.access(circuitJsonPath);
        } catch {
            return NextResponse.json(
                { 
                    error: 'Circuit not compiled',
                    errorCode: ErrorCodes.CIRCUIT_NOT_COMPILED,
                    details: 'Run: cd circuits/min_balance && nargo compile'
                },
                { status: 500 }
            );
        }

        // Write Prover.toml with the inputs (nargo reads from this)
        const proverTomlPath = path.join(CIRCUIT_DIR, 'Prover.toml');
        const proverContent = `# Private inputs\nbalance = "${balance}"\n\n# Public inputs  \nthreshold = "${threshold}"`;
        await fs.writeFile(proverTomlPath, proverContent);
        console.log('[Prove API] Written Prover.toml');

        // Generate witness using nargo execute
        console.log('[Prove API] Running nargo execute...');
        try {
            await execAsync(`cd ${CIRCUIT_DIR} && nargo execute`);
        } catch (execError) {
            const errorMsg = execError instanceof Error ? execError.message : String(execError);
            console.error('[Prove API] nargo execute failed:', errorMsg);
            
            // Check for common assertion failure
            if (errorMsg.includes('assertion') || errorMsg.includes('failed')) {
                return NextResponse.json(
                    { 
                        error: 'Balance verification failed',
                        errorCode: ErrorCodes.BALANCE_BELOW_THRESHOLD,
                        details: 'The circuit assertion failed. This usually means your balance is below the required threshold.'
                    },
                    { status: 400 }
                );
            }
            
            return NextResponse.json(
                { 
                    error: 'Witness generation failed',
                    errorCode: ErrorCodes.WITNESS_GENERATION_FAILED,
                    details: errorMsg
                },
                { status: 500 }
            );
        }

        // Check if witness file was created
        const witnessGzPath = path.join(TARGET_DIR, 'min_balance.gz');
        try {
            await fs.access(witnessGzPath);
        } catch {
            return NextResponse.json(
                { 
                    error: 'Witness file not generated',
                    errorCode: ErrorCodes.WITNESS_GENERATION_FAILED,
                    details: 'nargo execute completed but witness file was not created'
                },
                { status: 500 }
            );
        }
        console.log('[Prove API] Witness generated');

        // Check if setup files exist (CCS and PK)
        const ccsPath = path.join(TARGET_DIR, 'min_balance.ccs');
        const pkPath = path.join(TARGET_DIR, 'min_balance.pk');
        
        let hasCcs = false;
        let hasPk = false;
        
        try {
            await fs.access(ccsPath);
            hasCcs = true;
        } catch {
            console.log('[Prove API] CCS file not found');
        }
        
        try {
            await fs.access(pkPath);
            hasPk = true;
        } catch {
            console.log('[Prove API] PK file not found');
        }

        // Run sunspot compile and setup if needed
        if (!hasCcs || !hasPk) {
            console.log('[Prove API] Running sunspot compile and setup...');
            try {
                // First compile ACIR to CCS if needed
                if (!hasCcs) {
                    await execAsync(`cd ${CIRCUIT_DIR} && sunspot compile target/min_balance.json`);
                }
                // Then run setup to generate proving key
                await execAsync(`cd ${CIRCUIT_DIR} && sunspot setup target/min_balance.ccs`);
            } catch (setupError) {
                const errorMsg = setupError instanceof Error ? setupError.message : String(setupError);
                console.error('[Prove API] sunspot setup failed:', errorMsg);
                return NextResponse.json(
                    { 
                        error: 'Proof setup failed',
                        errorCode: ErrorCodes.SETUP_REQUIRED,
                        details: `sunspot setup failed: ${errorMsg}`
                    },
                    { status: 500 }
                );
            }
        }

        // Run sunspot prove to generate Groth16 proof
        const sunspotCmd = `cd ${CIRCUIT_DIR} && sunspot prove target/min_balance.json target/min_balance.gz target/min_balance.ccs target/min_balance.pk`;

        console.log('[Prove API] Running sunspot prove...');
        try {
            const { stdout, stderr } = await execAsync(sunspotCmd);
            console.log('[Prove API] Sunspot output:', stdout, stderr);
        } catch (proveError) {
            const errorMsg = proveError instanceof Error ? proveError.message : String(proveError);
            console.error('[Prove API] sunspot prove failed:', errorMsg);
            return NextResponse.json(
                { 
                    error: 'Proof generation failed',
                    errorCode: ErrorCodes.PROOF_GENERATION_FAILED,
                    details: `sunspot prove failed: ${errorMsg}`
                },
                { status: 500 }
            );
        }

        // Read the generated proof and public witness from target directory
        const proofPath = path.join(TARGET_DIR, 'min_balance.proof');
        const publicWitnessPath = path.join(TARGET_DIR, 'min_balance.pw');

        let proof: Buffer;
        let publicWitness: Buffer;

        try {
            proof = await fs.readFile(proofPath);
            publicWitness = await fs.readFile(publicWitnessPath);
        } catch (readError) {
            const errorMsg = readError instanceof Error ? readError.message : String(readError);
            console.error('[Prove API] Failed to read proof files:', errorMsg);
            return NextResponse.json(
                { 
                    error: 'Failed to read generated proof',
                    errorCode: ErrorCodes.PROOF_GENERATION_FAILED,
                    details: errorMsg
                },
                { status: 500 }
            );
        }

        console.log('[Prove API] Proof generated successfully!');
        console.log('[Prove API] Proof size:', proof.length, 'bytes');
        console.log('[Prove API] Public witness size:', publicWitness.length, 'bytes');

        return NextResponse.json({
            success: true,
            circuit: 'min_balance',
            proof: Array.from(proof),
            publicInputs: Array.from(publicWitness),
            metadata: {
                threshold,
                proofSize: proof.length,
                publicInputsSize: publicWitness.length,
            }
        });

    } catch (error: unknown) {
        console.error('[Prove API] Unexpected error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { 
                error: 'Proof generation failed',
                errorCode: ErrorCodes.INTERNAL_ERROR,
                details: message 
            },
            { status: 500 }
        );
    }
}

/**
 * Health check endpoint
 * Returns API status and circuit compilation state
 */
export async function GET() {
    // Check if circuit is compiled
    const circuitJsonPath = path.join(TARGET_DIR, 'min_balance.json');
    let isCompiled = false;
    
    try {
        await fs.access(circuitJsonPath);
        isCompiled = true;
    } catch {
        isCompiled = false;
    }

    // Check for required tools
    const hasNargo = await commandExists('nargo');
    const hasSunspot = await commandExists('sunspot');

    return NextResponse.json({
        status: hasNargo && hasSunspot && isCompiled ? 'ready' : 'setup_required',
        message: 'Min Balance Proof API',
        circuit: 'min_balance',
        isCompiled,
        tools: {
            nargo: hasNargo,
            sunspot: hasSunspot,
        },
        description: 'Proves balance >= threshold without revealing actual balance',
        inputs: {
            private: ['balance'],
            public: ['threshold']
        },
        setupInstructions: !hasNargo || !hasSunspot || !isCompiled ? {
            nargo: !hasNargo ? 'curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash && noirup -v 1.0.0-beta.1' : null,
            sunspot: !hasSunspot ? 'git clone https://github.com/reilabs/sunspot.git && cd sunspot/go && go build -o sunspot . && sudo mv sunspot /usr/local/bin/' : null,
            compile: !isCompiled ? 'cd circuits/min_balance && nargo compile' : null,
        } : null,
    });
}
