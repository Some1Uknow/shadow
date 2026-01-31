const BN254_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

export function hashAccountData(bytes: Uint8Array): string {
    let h = BigInt(0);
    for (const b of bytes) {
        h = (h * BigInt(31) + BigInt(b)) % BN254_MODULUS;
    }
    return h.toString();
}

export function readU64Le(bytes: Uint8Array, offset: number): string {
    let value = BigInt(0);
    let factor = BigInt(1);
    for (let i = 0; i < 8; i += 1) {
        value += BigInt(bytes[offset + i]) * factor;
        factor *= BigInt(256);
    }
    return value.toString();
}
