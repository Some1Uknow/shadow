import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import bs58 from 'bs58';

const execAsync = promisify(exec);

// Path to circuit directory (relative to project root)
const PROJECT_ROOT = path.join(process.cwd(), '..');
const CIRCUIT_DIR = path.join(PROJECT_ROOT, 'circuits', 'token_holder');
const TARGET_DIR = path.join(CIRCUIT_DIR, 'target');

/**
 * Convert a Solana base58 address to a decimal field value for Noir circuits
 * Takes the first 16 bytes to avoid sunspot hex parsing issues
 * Returns a decimal string representation
 */
function addressToField(address: string): string {
    try {
        // If already a decimal number string, return as-is
        if (/^\d+$/.test(address)) {
            return address;
        }
        
        // If hex, convert to decimal (truncate to 16 bytes / 32 hex chars)
        if (address.startsWith('0x')) {
            const hexPart = address.slice(2, 34); // Take first 32 hex chars (16 bytes)
            return BigInt('0x' + hexPart).toString();
        }
        
        // Decode base58 to bytes
        const bytes = bs58.decode(address);
        
        // Take first 16 bytes to avoid sunspot issues with large hex values
        const truncatedBytes = bytes.slice(0, 16);
        
        // Convert to decimal string (BigInt handles large numbers)
        let value = BigInt(0);
        for (const byte of truncatedBytes) {
            value = (value << BigInt(8)) | BigInt(byte);
        }
        
        return value.toString();
    } catch {
        // If decoding fails, hash the string to get a deterministic field value
        let hash = BigInt(0);
        for (let i = 0; i < address.length; i++) {
            const char = BigInt(address.charCodeAt(i));
            hash = ((hash << BigInt(5)) - hash) + char;
        }
        // Ensure positive and within field
        if (hash < 0) hash = -hash;
        return hash.toString();
    }
}

/**
 * Error codes for better client-side handling
 */
const ErrorCodes = {
    MISSING_PARAMS: 'MISSING_PARAMS',
    INVALID_AMOUNT: 'INVALID_AMOUNT',
    INSUFFICIENT_HOLDINGS: 'INSUFFICIENT_HOLDINGS',
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
 * Token Holder Proof API
 * 
 * Generates a ZK proof that a user holds at least `min_required` tokens
 * of a specific `token_mint` without revealing:
 * - Their actual token amount
 * - Their wallet address
 * 
 * Use cases:
 * - Token-gated pool access (e.g., "must hold 10,000+ BONK")
 * - DAO voting eligibility verification
 * - Whale-tier verification without exposing holdings
 * 
 * Request body:
 * - token_amount: string (amount held, in smallest units)
 * - user_address: string (wallet address as hex/base58)
 * - token_mint: string (token mint address)
 * - min_required: string (minimum required, in smallest units)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token_amount, user_address, token_mint, min_required } = body;

        // Validate required inputs
        if (token_amount === undefined || token_amount === null) {
            return NextResponse.json(
                { 
                    error: 'Missing token_amount',
                    errorCode: ErrorCodes.MISSING_PARAMS,
                    details: 'token_amount must be provided as a string representing the token balance in smallest units'
                },
                { status: 400 }
            );
        }

        if (!user_address) {
            return NextResponse.json(
                { 
                    error: 'Missing user_address',
                    errorCode: ErrorCodes.MISSING_PARAMS,
                    details: 'user_address must be provided (wallet public key)'
                },
                { status: 400 }
            );
        }

        if (!token_mint) {
            return NextResponse.json(
                { 
                    error: 'Missing token_mint',
                    errorCode: ErrorCodes.MISSING_PARAMS,
                    details: 'token_mint must be provided (the SPL token mint address)'
                },
                { status: 400 }
            );
        }

        if (min_required === undefined || min_required === null) {
            return NextResponse.json(
                { 
                    error: 'Missing min_required',
                    errorCode: ErrorCodes.MISSING_PARAMS,
                    details: 'min_required must be provided as a string representing the minimum token amount'
                },
                { status: 400 }
            );
        }

        // Validate token amount meets minimum (pre-check for better UX)
        const tokenAmountNum = BigInt(token_amount);
        const minRequiredNum = BigInt(min_required);

        if (tokenAmountNum < BigInt(0)) {
            return NextResponse.json(
                { 
                    error: 'Invalid token amount: must be non-negative',
                    errorCode: ErrorCodes.INVALID_AMOUNT,
                    details: `Received token_amount: ${token_amount}`
                },
                { status: 400 }
            );
        }

        if (tokenAmountNum < minRequiredNum) {
            return NextResponse.json(
                { 
                    error: 'Insufficient token holdings',
                    errorCode: ErrorCodes.INSUFFICIENT_HOLDINGS,
                    details: `You have ${token_amount} tokens but need at least ${min_required}. Please acquire more tokens to meet the requirement.`
                },
                { status: 400 }
            );
        }

        console.log('[Token Holder API] Generating proof for:', {
            token_amount,
            user_address: user_address.substring(0, 10) + '...',
            token_mint: token_mint.substring(0, 10) + '...',
            min_required
        });

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
        const circuitJsonPath = path.join(TARGET_DIR, 'token_holder.json');
        try {
            await fs.access(circuitJsonPath);
        } catch {
            return NextResponse.json(
                { 
                    error: 'Circuit not compiled',
                    errorCode: ErrorCodes.CIRCUIT_NOT_COMPILED,
                    details: 'Run: cd circuits/token_holder && nargo compile'
                },
                { status: 500 }
            );
        }

        // Convert addresses to field-compatible hex format
        const userAddressField = addressToField(user_address);
        const tokenMintField = addressToField(token_mint);
        console.log('[Token Holder API] Converted addresses:', { userAddressField, tokenMintField });

        // Write Prover.toml with the inputs
        const proverTomlPath = path.join(CIRCUIT_DIR, 'Prover.toml');
        const proverContent = `# Private inputs (witness)
token_amount = "${token_amount}"
user_address = "${userAddressField}"

# Public inputs
token_mint = "${tokenMintField}"
min_required = "${min_required}"`;

        await fs.writeFile(proverTomlPath, proverContent);
        console.log('[Token Holder API] Written Prover.toml');

        // Generate witness using nargo execute
        console.log('[Token Holder API] Running nargo execute...');
        try {
            await execAsync(`cd ${CIRCUIT_DIR} && nargo execute`);
        } catch (execError) {
            const errorMsg = execError instanceof Error ? execError.message : String(execError);
            console.error('[Token Holder API] nargo execute failed:', errorMsg);
            
            if (errorMsg.includes('assertion') || errorMsg.includes('failed')) {
                return NextResponse.json(
                    { 
                        error: 'Token holding verification failed',
                        errorCode: ErrorCodes.INSUFFICIENT_HOLDINGS,
                        details: 'The circuit assertion failed. This usually means your token holdings are below the required minimum.'
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
        const witnessGzPath = path.join(TARGET_DIR, 'token_holder.gz');
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
        console.log('[Token Holder API] Witness generated');

        // Check if CCS and PK files exist
        const ccsPath = path.join(TARGET_DIR, 'token_holder.ccs');
        const pkPath = path.join(TARGET_DIR, 'token_holder.pk');
        
        let hasCcs = false;
        let hasPk = false;
        
        try {
            await fs.access(ccsPath);
            hasCcs = true;
        } catch {
            console.log('[Token Holder API] CCS file not found');
        }
        
        try {
            await fs.access(pkPath);
            hasPk = true;
        } catch {
            console.log('[Token Holder API] PK file not found');
        }

        // Run sunspot compile and setup if needed
        if (!hasCcs || !hasPk) {
            console.log('[Token Holder API] Running sunspot compile and setup...');
            try {
                // First compile ACIR to CCS if needed
                if (!hasCcs) {
                    await execAsync(`cd ${CIRCUIT_DIR} && sunspot compile target/token_holder.json`);
                }
                // Then run setup to generate proving key
                await execAsync(`cd ${CIRCUIT_DIR} && sunspot setup target/token_holder.ccs`);
            } catch (setupError) {
                const errorMsg = setupError instanceof Error ? setupError.message : String(setupError);
                console.error('[Token Holder API] sunspot setup failed:', errorMsg);
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

        // Run sunspot prove
        const sunspotCmd = `cd ${CIRCUIT_DIR} && sunspot prove target/token_holder.json target/token_holder.gz target/token_holder.ccs target/token_holder.pk`;

        console.log('[Token Holder API] Running sunspot prove...');
        try {
            const { stdout, stderr } = await execAsync(sunspotCmd);
            console.log('[Token Holder API] Sunspot output:', stdout, stderr);
        } catch (proveError) {
            const errorMsg = proveError instanceof Error ? proveError.message : String(proveError);
            console.error('[Token Holder API] sunspot prove failed:', errorMsg);
            return NextResponse.json(
                { 
                    error: 'Proof generation failed',
                    errorCode: ErrorCodes.PROOF_GENERATION_FAILED,
                    details: `sunspot prove failed: ${errorMsg}`
                },
                { status: 500 }
            );
        }

        // Read the generated proof and public witness
        const proofPath = path.join(TARGET_DIR, 'token_holder.proof');
        const publicWitnessPath = path.join(TARGET_DIR, 'token_holder.pw');

        let proof: Buffer;
        let publicWitness: Buffer;

        try {
            proof = await fs.readFile(proofPath);
            publicWitness = await fs.readFile(publicWitnessPath);
        } catch (readError) {
            const errorMsg = readError instanceof Error ? readError.message : String(readError);
            console.error('[Token Holder API] Failed to read proof files:', errorMsg);
            return NextResponse.json(
                { 
                    error: 'Failed to read generated proof',
                    errorCode: ErrorCodes.PROOF_GENERATION_FAILED,
                    details: errorMsg
                },
                { status: 500 }
            );
        }

        console.log('[Token Holder API] Proof generated successfully!');
        console.log('[Token Holder API] Proof size:', proof.length, 'bytes');
        console.log('[Token Holder API] Public witness size:', publicWitness.length, 'bytes');

        return NextResponse.json({
            success: true,
            circuit: 'token_holder',
            proof: Array.from(proof),
            publicInputs: Array.from(publicWitness),
            metadata: {
                token_mint,
                min_required,
                proofSize: proof.length,
                publicInputsSize: publicWitness.length,
            }
        });

    } catch (error: unknown) {
        console.error('[Token Holder API] Unexpected error:', error);
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
 */
export async function GET() {
    // Check if circuit is compiled
    const circuitJsonPath = path.join(TARGET_DIR, 'token_holder.json');
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
        message: 'Token Holder Proof API',
        circuit: 'token_holder',
        isCompiled,
        tools: {
            nargo: hasNargo,
            sunspot: hasSunspot,
        },
        description: 'Proves token ownership >= minimum without revealing actual amount or address',
        inputs: {
            private: ['token_amount', 'user_address'],
            public: ['token_mint', 'min_required']
        },
        useCases: [
            'Token-gated pool access',
            'DAO voting eligibility',
            'Whale-tier verification',
            'Governance token requirements'
        ],
        setupInstructions: !hasNargo || !hasSunspot || !isCompiled ? {
            nargo: !hasNargo ? 'curl -L https://raw.githubusercontent.com/noir-lang/noirup/refs/heads/main/install | bash && noirup -v 1.0.0-beta.1' : null,
            sunspot: !hasSunspot ? 'git clone https://github.com/reilabs/sunspot.git && cd sunspot/go && go build -o sunspot . && sudo mv sunspot /usr/local/bin/' : null,
            compile: !isCompiled ? 'cd circuits/token_holder && nargo compile' : null,
        } : null,
    });
}
