import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Path to circuit directory (relative to project root)
const PROJECT_ROOT = path.join(process.cwd(), '..');
const CIRCUIT_DIR = path.join(PROJECT_ROOT, 'circuits', 'smt_exclusion');
const TARGET_DIR = path.join(CIRCUIT_DIR, 'target');

// Tree depth for the SMT
const TREE_DEPTH = 32;

/**
 * SMT Exclusion Proof API
 * 
 * Generates a ZK proof that an address is NOT on a blacklist
 * using a Sparse Merkle Tree non-membership proof.
 * 
 * The proof demonstrates:
 * - The address's slot in the blacklist tree is empty
 * - The merkle path is valid for the given root
 * - Therefore, the address is NOT blacklisted
 * 
 * Use cases:
 * - Sanctions/OFAC compliance without revealing address
 * - Anti-sybil verification
 * - Clean wallet verification
 * - KYC-compliant DeFi access
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, path_indices, sibling_path, root } = body;

        // Validate required inputs
        if (!address) {
            return NextResponse.json(
                { error: 'Missing address' },
                { status: 400 }
            );
        }

        if (!path_indices || !Array.isArray(path_indices)) {
            return NextResponse.json(
                { error: 'Missing or invalid path_indices (must be array of 32 elements)' },
                { status: 400 }
            );
        }

        if (path_indices.length !== TREE_DEPTH) {
            return NextResponse.json(
                { error: `path_indices must have exactly ${TREE_DEPTH} elements` },
                { status: 400 }
            );
        }

        if (!sibling_path || !Array.isArray(sibling_path)) {
            return NextResponse.json(
                { error: 'Missing or invalid sibling_path (must be array of 32 elements)' },
                { status: 400 }
            );
        }

        if (sibling_path.length !== TREE_DEPTH) {
            return NextResponse.json(
                { error: `sibling_path must have exactly ${TREE_DEPTH} elements` },
                { status: 400 }
            );
        }

        if (!root) {
            return NextResponse.json(
                { error: 'Missing root (blacklist merkle root)' },
                { status: 400 }
            );
        }

        // Validate path_indices are all 0 or 1
        for (let i = 0; i < path_indices.length; i++) {
            const val = parseInt(path_indices[i]);
            if (val !== 0 && val !== 1) {
                return NextResponse.json(
                    { error: `path_indices[${i}] must be 0 or 1, got ${path_indices[i]}` },
                    { status: 400 }
                );
            }
        }

        console.log('[Exclusion API] Generating proof for:', {
            address: address.substring(0, 10) + '...',
            root: root.substring(0, 10) + '...',
            pathIndicesLength: path_indices.length,
            siblingPathLength: sibling_path.length
        });

        // Format arrays for TOML
        const pathIndicesStr = path_indices.map((v: string | number) => `"${v}"`).join(', ');
        const siblingPathStr = sibling_path.map((v: string | number) => `"${v}"`).join(', ');

        // Write Prover.toml with the inputs
        const proverTomlPath = path.join(CIRCUIT_DIR, 'Prover.toml');
        const proverContent = `# SMT Exclusion Proof - Generated Inputs

# Private inputs (witness)
address = "${address}"
path_indices = [${pathIndicesStr}]

# Public inputs
sibling_path = [${siblingPathStr}]
root = "${root}"`;

        await fs.writeFile(proverTomlPath, proverContent);
        console.log('[Exclusion API] Written Prover.toml');

        // Generate witness using nargo execute
        console.log('[Exclusion API] Running nargo execute...');
        try {
            await execAsync(`cd ${CIRCUIT_DIR} && nargo execute`);
        } catch (execError) {
            console.error('[Exclusion API] nargo execute failed:', execError);
            return NextResponse.json(
                { 
                    error: 'Proof generation failed',
                    details: 'Circuit execution failed - address may be on blacklist or invalid merkle path'
                },
                { status: 400 }
            );
        }

        // Check if witness file was created
        const witnessGzPath = path.join(TARGET_DIR, 'smt_exclusion.gz');
        try {
            await fs.access(witnessGzPath);
        } catch {
            return NextResponse.json(
                { error: 'Witness generation failed' },
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
            console.log('[Exclusion API] CCS file not found, will use JSON');
        }
        
        try {
            await fs.access(pkPath);
            hasPk = true;
        } catch {
            console.log('[Exclusion API] PK file not found');
        }

        // Run sunspot prove to generate Groth16 proof
        let sunspotCmd: string;
        if (hasCcs && hasPk) {
            sunspotCmd = `cd ${CIRCUIT_DIR} && sunspot prove target/smt_exclusion.json target/smt_exclusion.gz target/smt_exclusion.ccs target/smt_exclusion.pk`;
        } else {
            // First time setup - generate CCS and PK
            console.log('[Exclusion API] Running sunspot setup first...');
            try {
                await execAsync(`cd ${CIRCUIT_DIR} && sunspot setup target/smt_exclusion.json`);
            } catch (setupError) {
                console.error('[Exclusion API] sunspot setup failed:', setupError);
                return NextResponse.json(
                    { error: 'Proof setup failed', details: 'sunspot setup failed' },
                    { status: 500 }
                );
            }
            sunspotCmd = `cd ${CIRCUIT_DIR} && sunspot prove target/smt_exclusion.json target/smt_exclusion.gz target/smt_exclusion.ccs target/smt_exclusion.pk`;
        }

        console.log('[Exclusion API] Running sunspot prove...');
        try {
            const { stdout, stderr } = await execAsync(sunspotCmd);
            console.log('[Exclusion API] Sunspot output:', stdout, stderr);
        } catch (proveError) {
            console.error('[Exclusion API] sunspot prove failed:', proveError);
            return NextResponse.json(
                { error: 'Proof generation failed', details: 'sunspot prove failed' },
                { status: 500 }
            );
        }

        // Read the generated proof and public witness from target directory
        const proofPath = path.join(TARGET_DIR, 'smt_exclusion.proof');
        const publicWitnessPath = path.join(TARGET_DIR, 'smt_exclusion.pw');

        let proof: Buffer;
        let publicWitness: Buffer;

        try {
            proof = await fs.readFile(proofPath);
            publicWitness = await fs.readFile(publicWitnessPath);
        } catch (readError) {
            console.error('[Exclusion API] Failed to read proof files:', readError);
            return NextResponse.json(
                { error: 'Failed to read generated proof' },
                { status: 500 }
            );
        }

        console.log('[Exclusion API] Proof generated successfully!');
        console.log('[Exclusion API] Proof size:', proof.length, 'bytes');
        console.log('[Exclusion API] Public witness size:', publicWitness.length, 'bytes');

        return NextResponse.json({
            success: true,
            circuit: 'smt_exclusion',
            proof: Array.from(proof),
            publicInputs: Array.from(publicWitness),
            metadata: {
                root,
                treeDepth: TREE_DEPTH,
                proofSize: proof.length,
                publicInputsSize: publicWitness.length,
            }
        });

    } catch (error: unknown) {
        console.error('[Exclusion API] Error:', error);
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
    const circuitJsonPath = path.join(TARGET_DIR, 'smt_exclusion.json');
    let isCompiled = false;
    
    try {
        await fs.access(circuitJsonPath);
        isCompiled = true;
    } catch {
        isCompiled = false;
    }

    return NextResponse.json({
        status: 'ok',
        message: 'SMT Exclusion Proof API ready',
        circuit: 'smt_exclusion',
        isCompiled,
        description: 'Proves an address is NOT on a blacklist using Sparse Merkle Tree non-membership proof',
        treeDepth: TREE_DEPTH,
        inputs: {
            private: ['address', 'path_indices'],
            public: ['sibling_path', 'root']
        },
        useCases: [
            'Sanctions/OFAC compliance',
            'Anti-sybil verification',
            'Clean wallet verification',
            'KYC-compliant DeFi access'
        ]
    });
}

/**
 * Helper endpoint to generate empty tree proof inputs
 * This is useful for testing when no blacklist exists yet
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { address } = body;

        if (!address) {
            return NextResponse.json(
                { error: 'Missing address' },
                { status: 400 }
            );
        }

        // For an empty tree, all siblings are hashes of empty subtrees
        // and the root is the hash of the complete empty tree
        // This is a simplified version - in production, you'd compute this properly
        const emptyPathIndices = new Array(TREE_DEPTH).fill('0');
        const emptySiblingPath = new Array(TREE_DEPTH).fill('0');
        
        // Empty tree root (all zeros for simplicity in testing)
        // In production, this would be the actual computed empty tree root
        const emptyRoot = '0x0';

        return NextResponse.json({
            success: true,
            message: 'Generated empty tree proof inputs',
            inputs: {
                address,
                path_indices: emptyPathIndices,
                sibling_path: emptySiblingPath,
                root: emptyRoot
            },
            note: 'These inputs are for testing with an empty blacklist tree'
        });

    } catch (error: unknown) {
        console.error('[Exclusion API] Error generating empty tree inputs:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Failed to generate inputs', details: message },
            { status: 500 }
        );
    }
}
