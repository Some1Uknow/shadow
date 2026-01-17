import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import bs58 from 'bs58';

const execAsync = promisify(exec);

// Path to circuit directory (relative to project root)
const PROJECT_ROOT = path.join(process.cwd(), '..');
const CIRCUIT_DIR = path.join(PROJECT_ROOT, 'circuits', 'smt_exclusion');
const TARGET_DIR = path.join(CIRCUIT_DIR, 'target');

/**
 * Error codes for better client-side handling
 */
const ErrorCodes = {
    MISSING_PARAMS: 'MISSING_PARAMS',
    ADDRESS_BLACKLISTED: 'ADDRESS_BLACKLISTED',
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
 * Convert a Solana base58 address to a decimal field value for Noir circuits
 */
function addressToField(address: string): string {
    try {
        // If already a decimal number string, return as-is
        if (/^\d+$/.test(address)) {
            return address;
        }
        
        // If hex, convert to decimal
        if (address.startsWith('0x')) {
            const hexPart = address.slice(2, 34);
            return BigInt('0x' + hexPart).toString();
        }
        
        // Decode base58 to bytes
        const bytes = bs58.decode(address);
        
        // Take first 16 bytes to avoid sunspot issues
        const truncatedBytes = bytes.slice(0, 16);
        
        // Convert to decimal string
        let value = BigInt(0);
        for (const byte of truncatedBytes) {
            value = (value << BigInt(8)) | BigInt(byte);
        }
        
        return value.toString();
    } catch {
        // Fallback: hash the string
        let hash = BigInt(0);
        for (let i = 0; i < address.length; i++) {
            const char = BigInt(address.charCodeAt(i));
            hash = ((hash << BigInt(5)) - hash) + char;
        }
        if (hash < 0) hash = -hash;
        return hash.toString();
    }
}

/**
 * Generate a simple hash of the address for the simplified circuit
 */
function generateAddressHash(addressField: string): string {
    // Simple hash: multiply by a prime and add another prime
    const addr = BigInt(addressField);
    const hash = (addr * BigInt(31) + BigInt(17)) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    return hash.toString();
}

/**
 * SMT Exclusion Proof API (Simplified)
 * 
 * Generates a ZK proof that an address is NOT on a blacklist.
 * This is a simplified version for demo purposes.
 * 
 * Request body:
 * - address: string (address to prove exclusion for)
 * - blacklist_root: string (optional, defaults to "0" for empty blacklist)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, blacklist_root = "0" } = body;

        // Validate required inputs
        if (!address) {
            return NextResponse.json(
                { 
                    error: 'Missing address',
                    errorCode: ErrorCodes.MISSING_PARAMS,
                    details: 'address must be provided'
                },
                { status: 400 }
            );
        }

        console.log('[Exclusion API] Generating proof for:', {
            address: address.substring(0, 10) + '...',
            blacklist_root
        });

        // Check if nargo is available
        if (!await commandExists('nargo')) {
            return NextResponse.json(
                { 
                    error: 'Noir compiler (nargo) not found',
                    errorCode: ErrorCodes.NARGO_NOT_FOUND,
                    details: 'Please install nargo'
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
                    details: 'Please install sunspot'
                },
                { status: 500 }
            );
        }

        // Check if circuit is compiled
        const circuitJsonPath = path.join(TARGET_DIR, 'smt_exclusion.json');
        try {
            await fs.access(circuitJsonPath);
        } catch {
            return NextResponse.json(
                { 
                    error: 'Circuit not compiled',
                    errorCode: ErrorCodes.CIRCUIT_NOT_COMPILED,
                    details: 'Run: cd circuits/smt_exclusion && nargo compile'
                },
                { status: 500 }
            );
        }

        // Convert address to field-compatible format
        const addressField = addressToField(address);
        const addressHash = generateAddressHash(addressField);
        console.log('[Exclusion API] Converted address:', { addressField, addressHash });

        // Write Prover.toml with the inputs
        const proverTomlPath = path.join(CIRCUIT_DIR, 'Prover.toml');
        const proverContent = `# SMT Exclusion Proof - Generated Inputs

# Private inputs
address = "${addressField}"
address_hash = "${addressHash}"

# Public inputs
blacklist_root = "${blacklist_root}"`;

        await fs.writeFile(proverTomlPath, proverContent);
        console.log('[Exclusion API] Written Prover.toml');

        // Generate witness using nargo execute
        console.log('[Exclusion API] Running nargo execute...');
        try {
            await execAsync(`cd ${CIRCUIT_DIR} && nargo execute`);
        } catch (execError) {
            const errorMsg = execError instanceof Error ? execError.message : String(execError);
            console.error('[Exclusion API] nargo execute failed:', errorMsg);
            
            if (errorMsg.includes('assertion') || errorMsg.includes('failed')) {
                return NextResponse.json(
                    { 
                        error: 'Exclusion proof failed - address may be blacklisted',
                        errorCode: ErrorCodes.ADDRESS_BLACKLISTED,
                        details: 'The circuit assertion failed.'
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
        const witnessGzPath = path.join(TARGET_DIR, 'smt_exclusion.gz');
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
        console.log('[Exclusion API] Witness generated');

        // Check if CCS and PK files exist
        const ccsPath = path.join(TARGET_DIR, 'smt_exclusion.ccs');
        const pkPath = path.join(TARGET_DIR, 'smt_exclusion.pk');
        
        let hasCcs = false;
        let hasPk = false;
        
        try {
            await fs.access(ccsPath);
            hasCcs = true;
        } catch {
            console.log('[Exclusion API] CCS file not found');
        }
        
        try {
            await fs.access(pkPath);
            hasPk = true;
        } catch {
            console.log('[Exclusion API] PK file not found');
        }

        // Run sunspot compile and setup if needed
        if (!hasCcs || !hasPk) {
            console.log('[Exclusion API] Running sunspot compile and setup...');
            try {
                if (!hasCcs) {
                    await execAsync(`cd ${CIRCUIT_DIR} && sunspot compile target/smt_exclusion.json`);
                }
                await execAsync(`cd ${CIRCUIT_DIR} && sunspot setup target/smt_exclusion.ccs`);
            } catch (setupError) {
                const errorMsg = setupError instanceof Error ? setupError.message : String(setupError);
                console.error('[Exclusion API] sunspot setup failed:', errorMsg);
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
        const sunspotCmd = `cd ${CIRCUIT_DIR} && sunspot prove target/smt_exclusion.json target/smt_exclusion.gz target/smt_exclusion.ccs target/smt_exclusion.pk`;

        console.log('[Exclusion API] Running sunspot prove...');
        try {
            const { stdout, stderr } = await execAsync(sunspotCmd);
            console.log('[Exclusion API] Sunspot output:', stdout, stderr);
        } catch (proveError) {
            const errorMsg = proveError instanceof Error ? proveError.message : String(proveError);
            console.error('[Exclusion API] sunspot prove failed:', errorMsg);
            return NextResponse.json(
                { 
                    error: 'Proof generation failed',
                    errorCode: ErrorCodes.PROOF_GENERATION_FAILED,
                    details: errorMsg
                },
                { status: 500 }
            );
        }

        // Read the generated proof and public witness
        const proofPath = path.join(TARGET_DIR, 'smt_exclusion.proof');
        const pwPath = path.join(TARGET_DIR, 'smt_exclusion.pw');

        let proofBytes: Buffer;
        let pwBytes: Buffer;

        try {
            proofBytes = await fs.readFile(proofPath);
            pwBytes = await fs.readFile(pwPath);
        } catch (readError) {
            console.error('[Exclusion API] Failed to read proof files:', readError);
            return NextResponse.json(
                { 
                    error: 'Failed to read generated proof',
                    errorCode: ErrorCodes.PROOF_GENERATION_FAILED,
                    details: 'Proof files were not created'
                },
                { status: 500 }
            );
        }

        console.log('[Exclusion API] Proof generated successfully:', {
            proofSize: proofBytes.length,
            publicWitnessSize: pwBytes.length
        });

        return NextResponse.json({
            success: true,
            circuit: 'smt_exclusion',
            proof: Array.from(proofBytes),
            publicInputs: Array.from(pwBytes),
            metadata: {
                blacklist_root,
                proofSize: proofBytes.length,
                publicInputsSize: pwBytes.length
            }
        });

    } catch (error: unknown) {
        console.error('[Exclusion API] Unexpected error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { 
                error: 'Internal server error',
                errorCode: ErrorCodes.INTERNAL_ERROR,
                details: message 
            },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint for circuit info
 */
export async function GET() {
    const hasNargo = await commandExists('nargo');
    const hasSunspot = await commandExists('sunspot');
    
    let isCompiled = false;
    try {
        await fs.access(path.join(TARGET_DIR, 'smt_exclusion.json'));
        isCompiled = true;
    } catch {
        // Not compiled
    }

    return NextResponse.json({
        circuit: 'smt_exclusion',
        description: 'Proves an address is NOT on a blacklist without revealing the address',
        status: {
            nargo: hasNargo ? 'available' : 'not found',
            sunspot: hasSunspot ? 'available' : 'not found',
            compiled: isCompiled
        },
        inputs: {
            private: ['address', 'address_hash'],
            public: ['blacklist_root']
        },
        useCases: [
            'Sanctions/OFAC compliance',
            'Anti-sybil verification',
            'Clean wallet verification'
        ]
    });
}

/**
 * PUT endpoint to get default inputs for testing
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { address } = body;

        if (!address) {
            return NextResponse.json(
                { 
                    error: 'Missing address',
                    errorCode: ErrorCodes.MISSING_PARAMS,
                    details: 'address must be provided'
                },
                { status: 400 }
            );
        }

        const addressField = addressToField(address);
        const addressHash = generateAddressHash(addressField);

        return NextResponse.json({
            success: true,
            message: 'Generated exclusion proof inputs',
            inputs: {
                address: addressField,
                address_hash: addressHash,
                blacklist_root: "0" // Empty blacklist for demo
            }
        });

    } catch (error: unknown) {
        console.error('[Exclusion API] Error generating inputs:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { 
                error: 'Failed to generate inputs',
                errorCode: ErrorCodes.INTERNAL_ERROR,
                details: message 
            },
            { status: 500 }
        );
    }
}
