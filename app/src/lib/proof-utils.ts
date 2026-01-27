/**
 * Proof Utilities
 * Shared utilities for ZK proof generation across all circuit types
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import bs58 from 'bs58';

export const execAsync = promisify(exec);

// BN254 field modulus for Noir circuits
const BN254_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

// Path Helpers

const PROJECT_ROOT = path.join(process.cwd(), '..');

export function getCircuitDir(circuitName: string): string {
    return path.join(PROJECT_ROOT, 'circuits', circuitName);
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

/**
 * Convert a Solana address (base58) or hex address to a field element string.
 * Uses first 16 bytes to fit within BN254 field.
 */
export function addressToField(address: string): string {
    try {
        // Already a numeric string
        if (/^\d+$/.test(address)) return address;

        // Hex address
        if (address.startsWith('0x')) {
            return BigInt('0x' + address.slice(2, 34)).toString();
        }

        // Base58 (Solana) address - take first 16 bytes
        const bytes = bs58.decode(address).slice(0, 16);
        let value = BigInt(0);
        for (const byte of bytes) {
            value = (value << BigInt(8)) | BigInt(byte);
        }
        return value.toString();
    } catch {
        // Fallback: simple hash for invalid formats
        let hash = BigInt(0);
        for (let i = 0; i < address.length; i++) {
            hash = ((hash << BigInt(5)) - hash) + BigInt(address.charCodeAt(i));
        }
        return (hash < 0 ? -hash : hash).toString();
    }
}

/**
 * Generate a deterministic hash for an address field value.
 * Used for SMT exclusion proofs.
 */
export function generateAddressHash(addressField: string): string {
    const addr = BigInt(addressField);
    const hash = (addr * BigInt(31) + BigInt(17)) % BN254_MODULUS;
    return hash.toString();
}

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
