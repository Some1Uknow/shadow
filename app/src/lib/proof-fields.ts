import bs58 from 'bs58';

// BN254 field modulus for Noir circuits
const BN254_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

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

export function pubkeyToFieldBytes(pubkey: string): string {
    return addressToField(pubkey);
}

export function fieldToLeBytes32(field: string): number[] {
    let value = BigInt(field);
    const out = new Array(32).fill(0);
    for (let i = 0; i < 32; i++) {
        out[i] = Number(value & BigInt(0xff));
        value >>= BigInt(8);
    }
    return out;
}

export function fieldToBeBytes32(field: string): number[] {
    let value = BigInt(field);
    const out = new Array(32).fill(0);
    for (let i = 31; i >= 0; i--) {
        out[i] = Number(value & BigInt(0xff));
        value >>= BigInt(8);
    }
    return out;
}
