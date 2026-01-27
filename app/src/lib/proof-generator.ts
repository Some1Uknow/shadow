/**
 * Proof Generator
 * Core proof generation orchestration for Noir circuits via Sunspot
 */

import * as path from 'path';
import {
    execAsync,
    getCircuitDir,
    getTargetDir,
    fileExists,
    readProofFiles,
    type ProofFiles,
} from './proof-utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CircuitConfig {
    name: string;
    circuitDir: string;
    targetDir: string;
}

export interface ProofResult {
    success: true;
    circuit: string;
    proof: number[];
    publicInputs: number[];
    metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Circuit Configuration
// -----------------------------------------------------------------------------

export function createCircuitConfig(circuitName: string): CircuitConfig {
    return {
        name: circuitName,
        circuitDir: getCircuitDir(circuitName),
        targetDir: getTargetDir(circuitName),
    };
}

// -----------------------------------------------------------------------------
// Circuit Compilation Check
// -----------------------------------------------------------------------------

export async function isCircuitCompiled(config: CircuitConfig): Promise<boolean> {
    const circuitJsonPath = path.join(config.targetDir, `${config.name}.json`);
    return fileExists(circuitJsonPath);
}

// -----------------------------------------------------------------------------
// Witness Generation
// -----------------------------------------------------------------------------

export async function generateWitness(config: CircuitConfig): Promise<void> {
    await execAsync(`cd ${config.circuitDir} && nargo execute`);
}

export async function isWitnessGenerated(config: CircuitConfig): Promise<boolean> {
    const witnessPath = path.join(config.targetDir, `${config.name}.gz`);
    return fileExists(witnessPath);
}

// -----------------------------------------------------------------------------
// Sunspot Setup (CCS + PK generation)
// -----------------------------------------------------------------------------

export async function ensureSunspotSetup(config: CircuitConfig): Promise<void> {
    const ccsPath = path.join(config.targetDir, `${config.name}.ccs`);
    const pkPath = path.join(config.targetDir, `${config.name}.pk`);

    const [hasCcs, hasPk] = await Promise.all([
        fileExists(ccsPath),
        fileExists(pkPath),
    ]);

    // Compile ACIR to CCS if needed
    if (!hasCcs) {
        await execAsync(`cd ${config.circuitDir} && sunspot compile target/${config.name}.json`);
    }

    // Run setup to generate proving key if needed
    if (!hasPk) {
        await execAsync(`cd ${config.circuitDir} && sunspot setup target/${config.name}.ccs`);
    }
}

// -----------------------------------------------------------------------------
// Proof Generation
// -----------------------------------------------------------------------------

export async function runSunspotProve(config: CircuitConfig): Promise<void> {
    const { circuitDir, targetDir, name } = config;
    const cmd = [
        `cd ${circuitDir} && sunspot prove`,
        `target/${name}.json`,
        `target/${name}.gz`,
        `target/${name}.ccs`,
        `target/${name}.pk`,
    ].join(' ');

    await execAsync(cmd);
}

export async function getProofResult(config: CircuitConfig): Promise<ProofFiles> {
    return readProofFiles(config.targetDir, config.name);
}

// -----------------------------------------------------------------------------
// Full Proof Pipeline
// -----------------------------------------------------------------------------

export async function generateFullProof(
    config: CircuitConfig,
    metadata?: Record<string, unknown>
): Promise<ProofResult> {
    // Ensure sunspot setup is done
    await ensureSunspotSetup(config);

    // Generate the proof
    await runSunspotProve(config);

    // Read proof files
    const { proof, publicWitness } = await getProofResult(config);

    return {
        success: true,
        circuit: config.name,
        proof: Array.from(proof),
        publicInputs: Array.from(publicWitness),
        ...(metadata && { metadata }),
    };
}
