import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Path to circuit directory (relative to project root)
const PROJECT_ROOT = path.join(process.cwd(), '..');
const CIRCUIT_DIR = path.join(PROJECT_ROOT, 'circuits', 'token_holder');
const TARGET_DIR = path.join(CIRCUIT_DIR, 'target');

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
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token_amount, user_address, token_mint, min_required } = body;

        // Validate required inputs
        if (token_amount === undefined || token_amount === null) {
            return NextResponse.json(
                { error: 'Missing token_amount' },
                { status: 400 }
            );
        }

        if (!user_address) {
            return NextResponse.json(
                { error: 'Missing user_address' },
                { status: 400 }
            );
        }

        if (!token_mint) {
            return NextResponse.json(
                { error: 'Missing token_mint' },
                { status: 400 }
            );
        }

        if (min_required === undefined || min_required === null) {
            return NextResponse.json(
                { error: 'Missing min_required' },
                { status: 400 }
            );
        }

        // Validate token amount meets minimum
        const tokenAmountNum = BigInt(token_amount);
        const minRequiredNum = BigInt(min_required);

        if (tokenAmountNum < minRequiredNum) {
            return NextResponse.json(
                { 
                    error: 'Insufficient token holdings',
                    details: `You have ${token_amount} tokens but need at least ${min_required}`
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

        // Write Prover.toml with the inputs
        const proverTomlPath = path.join(CIRCUIT_DIR, 'Prover.toml');
        const proverContent = `# Private inputs (witness)
token_amount = "${token_amount}"
user_address = "${user_address}"

# Public inputs
token_mint = "${token_mint}"
min_required = "${min_required}"`;

        await fs.writeFile(proverTomlPath, proverContent);
        console.log('[Token Holder API] Written Prover.toml');

        // Generate witness using nargo execute
        console.log('[Token Holder API] Running nargo execute...');
        try {
            await execAsync(`cd ${CIRCUIT_DIR} && nargo execute`);
        } catch (execError) {
            console.error('[Token Holder API] nargo execute failed:', execError);
            return NextResponse.json(
                { 
                    error: 'Proof generation failed',
                    details: 'Circuit execution failed - likely insufficient token holdings'
                },
                { status: 400 }
            );
        }

        // Check if witness file was created
        const witnessGzPath = path.join(TARGET_DIR, 'token_holder.gz');
        try {
            await fs.access(witnessGzPath);
        } catch {
            return NextResponse.json(
                { error: 'Witness generation failed' },
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
            console.log('[Token Holder API] CCS file not found, will use JSON');
        }
        
        try {
            await fs.access(pkPath);
            hasPk = true;
        } catch {
            console.log('[Token Holder API] PK file not found');
        }

        // Run sunspot prove to generate Groth16 proof
        let sunspotCmd: string;
        if (hasCcs && hasPk) {
            sunspotCmd = `cd ${CIRCUIT_DIR} && sunspot prove target/token_holder.json target/token_holder.gz target/token_holder.ccs target/token_holder.pk`;
        } else {
            // First time setup - generate CCS and PK
            console.log('[Token Holder API] Running sunspot setup first...');
            try {
                await execAsync(`cd ${CIRCUIT_DIR} && sunspot setup target/token_holder.json`);
            } catch (setupError) {
                console.error('[Token Holder API] sunspot setup failed:', setupError);
                return NextResponse.json(
                    { error: 'Proof setup failed', details: 'sunspot setup failed' },
                    { status: 500 }
                );
            }
            sunspotCmd = `cd ${CIRCUIT_DIR} && sunspot prove target/token_holder.json target/token_holder.gz target/token_holder.ccs target/token_holder.pk`;
        }

        console.log('[Token Holder API] Running sunspot prove...');
        try {
            const { stdout, stderr } = await execAsync(sunspotCmd);
            console.log('[Token Holder API] Sunspot output:', stdout, stderr);
        } catch (proveError) {
            console.error('[Token Holder API] sunspot prove failed:', proveError);
            return NextResponse.json(
                { error: 'Proof generation failed', details: 'sunspot prove failed' },
                { status: 500 }
            );
        }

        // Read the generated proof and public witness from target directory
        const proofPath = path.join(TARGET_DIR, 'token_holder.proof');
        const publicWitnessPath = path.join(TARGET_DIR, 'token_holder.pw');

        let proof: Buffer;
        let publicWitness: Buffer;

        try {
            proof = await fs.readFile(proofPath);
            publicWitness = await fs.readFile(publicWitnessPath);
        } catch (readError) {
            console.error('[Token Holder API] Failed to read proof files:', readError);
            return NextResponse.json(
                { error: 'Failed to read generated proof' },
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
        console.error('[Token Holder API] Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Proof generation failed', details: message },
            { status: 500 }
        );
    }
}

// Health check endpoint
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

    return NextResponse.json({
        status: 'ok',
        message: 'Token Holder Proof API ready',
        circuit: 'token_holder',
        isCompiled,
        description: 'Proves token ownership >= minimum without revealing actual amount or address',
        inputs: {
            private: ['token_amount', 'user_address'],
            public: ['token_mint', 'min_required']
        }
    });
}
