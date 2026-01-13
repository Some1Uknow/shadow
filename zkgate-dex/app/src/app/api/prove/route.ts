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

export async function POST(request: NextRequest) {
    try {
        const { balance, threshold } = await request.json();

        if (!balance || !threshold) {
            return NextResponse.json(
                { error: 'Missing balance or threshold' },
                { status: 400 }
            );
        }

        console.log('[Prove API] Generating proof for:', { balance, threshold });

        // Write Prover.toml with the inputs (nargo reads from this)
        const proverTomlPath = path.join(CIRCUIT_DIR, 'Prover.toml');
        const proverContent = `# Private inputs\nbalance = "${balance}"\n\n# Public inputs  \nthreshold = "${threshold}"`;
        await fs.writeFile(proverTomlPath, proverContent);
        console.log('[Prove API] Written Prover.toml');

        // Generate witness using nargo execute
        console.log('[Prove API] Running nargo execute...');
        await execAsync(`cd ${CIRCUIT_DIR} && nargo execute`);

        // Check if witness file was created
        const witnessGzPath = path.join(TARGET_DIR, 'min_balance.gz');
        await fs.access(witnessGzPath);
        console.log('[Prove API] Witness generated');

        // Run sunspot prove to generate Groth16 proof
        // Note: sunspot outputs to target/min_balance.proof and target/min_balance.pw
        const sunspotCmd = `cd ${CIRCUIT_DIR} && sunspot prove target/min_balance.json target/min_balance.gz target/min_balance.ccs target/min_balance.pk`;

        console.log('[Prove API] Running sunspot prove...');
        const { stdout, stderr } = await execAsync(sunspotCmd);
        console.log('[Prove API] Sunspot output:', stdout, stderr);

        // Read the generated proof and public witness from target directory
        const proofPath = path.join(TARGET_DIR, 'min_balance.proof');
        const publicWitnessPath = path.join(TARGET_DIR, 'min_balance.pw');

        const proof = await fs.readFile(proofPath);
        const publicWitness = await fs.readFile(publicWitnessPath);

        console.log('[Prove API] Proof generated successfully!');
        console.log('[Prove API] Proof size:', proof.length, 'bytes');
        console.log('[Prove API] Public witness size:', publicWitness.length, 'bytes');

        return NextResponse.json({
            success: true,
            proof: Array.from(proof),
            publicInputs: Array.from(publicWitness),
        });

    } catch (error: unknown) {
        console.error('[Prove API] Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Proof generation failed', details: message },
            { status: 500 }
        );
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'ZK Proof API ready',
        circuit: 'min_balance',
    });
}
