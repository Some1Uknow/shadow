/**
 * Proof Utilities
 * Shared utilities for ZK proof generation across all circuit types
 */

import 'server-only';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { addressToField, fieldToLeBytes32, fieldToBeBytes32, generateAddressHash, pubkeyToFieldBytes } from './proof-fields';

export const execAsync = promisify(exec);

// BN254 field modulus for Noir circuits (defined in proof-fields)

// Path Helpers

// In Docker, circuits are at /circuits. In development, relative to app/
const CIRCUIT_ROOT = process.env.CIRCUIT_ROOT || path.join(process.cwd(), '..', 'circuits');

export function getCircuitDir(circuitName: string): string {
    return path.join(CIRCUIT_ROOT, circuitName);
}

export function getTargetDir(circuitName: string): string {
    return path.join(getCircuitDir(circuitName), 'target');
}

// Tool Availability Checks

export async function commandExists(cmd: string): Promise<boolean> {
    try {
        await execAsync(`which ${cmd}`);
        return true;
    } catch {
        return false;
    }
}

export interface ToolStatus {
    nargo: boolean;
    sunspot: boolean;
    allAvailable: boolean;
}

export async function checkRequiredTools(): Promise<ToolStatus> {
    const [nargo, sunspot] = await Promise.all([
        commandExists('nargo'),
        commandExists('sunspot'),
    ]);
    return { nargo, sunspot, allAvailable: nargo && sunspot };
}

// Address Conversion

export { addressToField, fieldToLeBytes32, fieldToBeBytes32, generateAddressHash, pubkeyToFieldBytes };

// File Operations

export async function writeProverToml(circuitDir: string, content: string): Promise<void> {
    const proverTomlPath = path.join(circuitDir, 'Prover.toml');
    await fs.writeFile(proverTomlPath, content);
}

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export interface ProofFiles {
    proof: Buffer;
    publicWitness: Buffer;
}

export async function readProofFiles(targetDir: string, circuitName: string): Promise<ProofFiles> {
    const proofPath = path.join(targetDir, `${circuitName}.proof`);
    const publicWitnessPath = path.join(targetDir, `${circuitName}.pw`);

    const [proof, publicWitness] = await Promise.all([
        fs.readFile(proofPath),
        fs.readFile(publicWitnessPath),
    ]);

    return { proof, publicWitness };
}
