import crypto from 'crypto';
import { buildPoseidon } from 'circomlibjs';

const BN254_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

let poseidonPromise: ReturnType<typeof buildPoseidon> | null = null;

async function getPoseidon() {
    if (!poseidonPromise) {
        poseidonPromise = buildPoseidon();
    }
    return poseidonPromise;
}

export async function poseidonHash(inputs: Array<bigint | number | string>): Promise<string> {
    const poseidon = await getPoseidon();
    const fieldInputs = inputs.map((v) => BigInt(v));
    const hash = poseidon(fieldInputs);
    return poseidon.F.toString(hash);
}

export function randomField(): string {
    let value = BigInt(0);
    while (value === BigInt(0) || value >= BN254_MODULUS) {
        const bytes = crypto.randomBytes(32);
        value = BigInt('0x' + bytes.toString('hex')) % BN254_MODULUS;
    }
    return value.toString();
}
