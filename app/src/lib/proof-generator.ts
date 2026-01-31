/**
 * Proof Generator
 * Core proof generation orchestration for Noir circuits via Sunspot
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import crypto from 'crypto';
import {
    execAsync,
    getCircuitDir,
    getTargetDir,
    fileExists,
    readProofFiles,
    type ProofFiles,
} from './proof-utils';

// Types

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

// Circuit Configuration

export function createCircuitConfig(circuitName: string): CircuitConfig {
    return {
        name: circuitName,
        circuitDir: getCircuitDir(circuitName),
        targetDir: getTargetDir(circuitName),
    };
}

// Circuit Compilation Check

export async function isCircuitCompiled(config: CircuitConfig): Promise<boolean> {
    const circuitJsonPath = path.join(config.targetDir, `${config.name}.json`);
    return fileExists(circuitJsonPath);
}

export async function ensureCircuitCompiled(config: CircuitConfig): Promise<void> {
    const circuitJsonPath = path.join(config.targetDir, `${config.name}.json`);
    const circuitSrcPath = path.join(config.circuitDir, 'src', 'main.nr');

    const hasJson = await fileExists(circuitJsonPath);
    if (!hasJson) {
        await execAsync(`cd ${config.circuitDir} && nargo compile`);
        return;
    }

    try {
        const [jsonStat, srcStat] = await Promise.all([
            fs.stat(circuitJsonPath),
            fs.stat(circuitSrcPath),
        ]);
        if (srcStat.mtimeMs > jsonStat.mtimeMs) {
            await execAsync(`cd ${config.circuitDir} && nargo compile`);
        }
    } catch {
        // if stat fails, fallback to compile
        await execAsync(`cd ${config.circuitDir} && nargo compile`);
    }
}

// Witness Generation

export async function generateWitness(config: CircuitConfig): Promise<void> {
    await execAsync(`cd ${config.circuitDir} && nargo execute`);
}

export async function isWitnessGenerated(config: CircuitConfig): Promise<boolean> {
    const witnessPath = path.join(config.targetDir, `${config.name}.gz`);
    return fileExists(witnessPath);
}

// Sunspot Setup (CCS + PK generation)

export async function ensureSunspotSetup(config: CircuitConfig): Promise<void> {
    const ccsPath = path.join(config.targetDir, `${config.name}.ccs`);
    const pkPath = path.join(config.targetDir, `${config.name}.pk`);
    const jsonPath = path.join(config.targetDir, `${config.name}.json`);

    const [hasCcs, hasPk] = await Promise.all([
        fileExists(ccsPath),
        fileExists(pkPath),
    ]);

    let needsCompile = !hasCcs;
    let needsSetup = !hasPk;

    if (hasCcs || hasPk) {
        try {
            const [ccsStat, pkStat, jsonStat] = await Promise.all([
                hasCcs ? fs.stat(ccsPath) : Promise.resolve(null),
                hasPk ? fs.stat(pkPath) : Promise.resolve(null),
                fs.stat(jsonPath),
            ]);
            if (ccsStat && jsonStat && jsonStat.mtimeMs > ccsStat.mtimeMs) {
                needsCompile = true;
            }
            if (pkStat && jsonStat && jsonStat.mtimeMs > pkStat.mtimeMs) {
                needsSetup = true;
            }
        } catch {
            needsCompile = true;
            needsSetup = true;
        }
    }

    // Compile ACIR to CCS if needed
    if (needsCompile) {
        await execAsync(`cd ${config.circuitDir} && sunspot compile target/${config.name}.json`);
    }

    // Run setup to generate proving key if needed
    if (needsSetup) {
        await execAsync(`cd ${config.circuitDir} && sunspot setup target/${config.name}.ccs`);
    }
}

// Proof Generation

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

export async function verifyProof(
    config: CircuitConfig,
    proofBytes: Uint8Array,
    publicWitnessBytes: Uint8Array
): Promise<void> {
    await ensureSunspotSetup(config);

    const primaryVkPath = path.join(config.targetDir, `${config.name}.vk`);
    const fallbackVkPath = path.join(process.cwd(), 'keys', config.name, 'verifying_key.vk');
    const hasPrimaryVk = await fileExists(primaryVkPath);
    const hasFallbackVk = await fileExists(fallbackVkPath);
    const vkPath = hasPrimaryVk ? primaryVkPath : hasFallbackVk ? fallbackVkPath : null;

    if (!vkPath) {
        throw new Error(`Verifying key not found for ${config.name}`);
    }

    const nonce = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const proofPath = path.join(config.targetDir, `${config.name}.${nonce}.proof`);
    const witnessPath = path.join(config.targetDir, `${config.name}.${nonce}.pw`);
    await fs.writeFile(proofPath, Buffer.from(proofBytes));
    await fs.writeFile(witnessPath, Buffer.from(publicWitnessBytes));

    try {
        await execAsync(`cd ${config.circuitDir} && sunspot verify ${vkPath} ${proofPath} ${witnessPath}`);
    } finally {
        await fs.unlink(proofPath).catch(() => undefined);
        await fs.unlink(witnessPath).catch(() => undefined);
    }
}

// -----------------------------------------------------------------------------
// Full Proof Pipeline
// -----------------------------------------------------------------------------

export async function generateFullProof(
    config: CircuitConfig,
    metadata?: Record<string, unknown>
): Promise<ProofResult> {
    await ensureCircuitCompiled(config);
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
