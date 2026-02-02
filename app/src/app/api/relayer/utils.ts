import {
    Keypair,
    PublicKey,
    TransactionInstruction,
} from '@solana/web3.js';
import { BorshCoder, type Idl } from '@coral-xyz/anchor';
import idl from '@/idl/zkgate.json';
import { createCircuitConfig, verifyProof } from '@/lib/proof-generator';

export function decodeNullifierHash(ixData: Buffer): { name: string; hash: Buffer } | null {
    try {
        const coder = new BorshCoder(idl as Idl);
        const decoded = coder.instruction.decode(ixData);
        if (decoded) {
            const raw =
                (decoded.data as Record<string, unknown>)['nullifier_hash'] ??
                (decoded.data as Record<string, unknown>)['nullifierHash'];
            if (raw instanceof Uint8Array || Array.isArray(raw) || Buffer.isBuffer(raw)) {
                return { name: decoded.name, hash: Buffer.from(raw as Uint8Array) };
            }
        }
    } catch {
        // fall through
    }

    // Layout: disc(8) + proof(u32+bytes) + public(u32+bytes) + amount(u64) + min(u64) + dir(bool) + nullifier([u8;32])
    try {
        let offset = 8;
        if (ixData.length < offset + 4) return null;
        const proofLen = ixData.readUInt32LE(offset);
        offset += 4 + proofLen;
        if (ixData.length < offset + 4) return null;
        const publicLen = ixData.readUInt32LE(offset);
        offset += 4 + publicLen;
        if (ixData.length < offset + 8 + 8 + 1 + 32) return null;
        offset += 8; // amount_in
        offset += 8; // min_out
        offset += 1; // is_a_to_b
        const hash = ixData.slice(offset, offset + 32);
        if (hash.length !== 32) return null;
        return { name: 'swap_private', hash };
    } catch {
        return null;
    }
}

export function decodeProofAndPublic(ixData: Buffer): { proof?: Buffer; publicInputs?: Buffer } {
    try {
        const coder = new BorshCoder(idl as Idl);
        const decoded = coder.instruction.decode(ixData);
        if (decoded) {
            const data = decoded.data as Record<string, unknown>;
            const proofRaw = data['proof'] ?? data['zk_proof'];
            const publicRaw = data['public_inputs'] ?? data['publicInputs'];
            const proof =
                proofRaw instanceof Uint8Array || Array.isArray(proofRaw) || Buffer.isBuffer(proofRaw)
                    ? Buffer.from(proofRaw as Uint8Array)
                    : undefined;
            const publicInputs =
                publicRaw instanceof Uint8Array || Array.isArray(publicRaw) || Buffer.isBuffer(publicRaw)
                    ? Buffer.from(publicRaw as Uint8Array)
                    : undefined;
            return { proof, publicInputs };
        }
    } catch {
        // fall through
    }

    try {
        let offset = 8; // discriminator
        if (ixData.length < offset + 4) return {};
        const proofLen = ixData.readUInt32LE(offset);
        offset += 4;
        const proof = ixData.slice(offset, offset + proofLen);
        offset += proofLen;
        if (ixData.length < offset + 4) return { proof };
        const publicLen = ixData.readUInt32LE(offset);
        offset += 4;
        const publicInputs = ixData.slice(offset, offset + publicLen);
        return { proof, publicInputs };
    } catch {
        return {};
    }
}

export function parseRequestBody(body: any) {
    const { proof, publicInputs, instructionData, accounts, eligibilityProofs, requireEligibility } = body ?? {};
    if (!proof || !publicInputs || !instructionData || !accounts) {
        return { ok: false as const, error: 'Missing parameters' };
    }
    if (requireEligibility && (!eligibilityProofs || eligibilityProofs.length === 0)) {
        return { ok: false as const, error: 'Eligibility proofs required' };
    }
    return {
        ok: true as const,
        proof,
        publicInputs,
        instructionData,
        accounts,
        eligibilityProofs,
        requireEligibility
    };
}

export async function verifyEligibility(eligibilityProofs: any[] | undefined) {
    if (!Array.isArray(eligibilityProofs) || eligibilityProofs.length === 0) return;
    for (const entry of eligibilityProofs) {
        const circuitName =
            entry.type === 'min_balance'
                ? 'min_balance'
                : entry.type === 'token_holder'
                    ? 'token_holder'
                    : entry.type === 'exclusion'
                        ? 'smt_exclusion'
                        : null;
        if (!circuitName || !entry.proof) {
            throw new Error('Invalid eligibility proof');
        }
        const config = createCircuitConfig(circuitName);
        await verifyProof(
            config,
            new Uint8Array(entry.proof),
            new Uint8Array(entry.publicInputs)
        );
    }
}

export function getRelayerKeypair(): Keypair {
    const relayerKeyString = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerKeyString) {
        throw new Error('Relayer Private Key not configured on server');
    }
    let secretKey: Uint8Array;
    try {
        secretKey = new Uint8Array(JSON.parse(relayerKeyString));
    } catch (e) {
        throw new Error('Failed to parse RELAYER_PRIVATE_KEY. Ensure it is a JSON array of numbers.');
    }
    return Keypair.fromSecretKey(secretKey);
}

export function buildNullifierMeta(ixData: Buffer, publicInputs: number[], accounts: any) {
    const decodedProof = decodeProofAndPublic(ixData);
    const decodedNullifier = decodeNullifierHash(ixData);
    let nullifierFromPublic: Buffer | null = null;
    if (Array.isArray(publicInputs) && publicInputs.length >= 64) {
        const headerOffset = publicInputs.length % 32 === 12 ? 12 : 0;
        nullifierFromPublic = Buffer.from(publicInputs.slice(headerOffset + 32, headerOffset + 64));
    }
    const nullifierHash = decodedNullifier?.hash ?? nullifierFromPublic;
    if (!nullifierHash) {
        throw new Error('Unable to decode nullifier hash');
    }
    const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);
    const inputShieldedPool = new PublicKey(accounts.inputShieldedPool);
    const [nullifierPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('nullifier'), inputShieldedPool.toBuffer(), nullifierHash],
        programId
    );
    const [nullifierPdaAlt] = PublicKey.findProgramAddressSync(
        [Buffer.from('nullifier'), inputShieldedPool.toBuffer(), Buffer.from(nullifierHash).reverse()],
        programId
    );
    const providedNullifierPda = accounts.nullifierAccount ? new PublicKey(accounts.nullifierAccount) : null;
    const nullifierPdaToUse = providedNullifierPda ?? nullifierPda;
    return {
        decodedProof,
        decodedNullifier,
        nullifierFromPublic,
        nullifierHash,
        nullifierPda,
        nullifierPdaAlt,
        nullifierPdaToUse,
        providedNullifierPda
    };
}

export function buildDebugInfo(meta: ReturnType<typeof buildNullifierMeta>, accounts: any, requestProof: Buffer | null, requestPublic: Buffer | null) {
    return {
        inputShieldedPool: accounts.inputShieldedPool,
        programId: process.env.NEXT_PUBLIC_PROGRAM_ID,
        nullifierHashHex: meta.nullifierHash.toString('hex'),
        nullifierFromPublicHex: meta.nullifierFromPublic?.toString('hex') || null,
        nullifierFromIxHex: meta.decodedNullifier?.hash?.toString('hex') || null,
        decodedIxName: meta.decodedNullifier?.name || null,
        derivedNullifierPda: meta.nullifierPda.toBase58(),
        derivedNullifierPdaAlt: meta.nullifierPdaAlt.toBase58(),
        providedNullifierPda: accounts.nullifierAccount || null,
        usingProvidedNullifierPda: meta.providedNullifierPda ? true : false,
        proofLen: meta.decodedProof.proof?.length ?? null,
        publicInputsLen: meta.decodedProof.publicInputs?.length ?? null,
        proofCommitments: meta.decodedProof.proof && meta.decodedProof.proof.length >= 260
            ? meta.decodedProof.proof.readUInt32BE(256)
            : null,
        requestProofLen: requestProof?.length ?? null,
        requestPublicLen: requestPublic?.length ?? null,
        proofPrefix: meta.decodedProof.proof?.subarray(0, 8)?.toString('hex') ?? null,
        requestProofPrefix: requestProof?.subarray(0, 8)?.toString('hex') ?? null,
    };
}

export function buildInstruction(ixData: Buffer, accounts: any, relayerKeypair: Keypair, nullifierPdaToUse: PublicKey) {
    return new TransactionInstruction({
        programId: new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
        keys: [
            { pubkey: new PublicKey(accounts.pool), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(accounts.inputShieldedPool), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(accounts.inputRootHistory), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(accounts.verifierProgram), isSigner: false, isWritable: false },
            { pubkey: nullifierPdaToUse, isSigner: false, isWritable: true },
            { pubkey: relayerKeypair.publicKey, isSigner: true, isWritable: true }, // relayer pays
            { pubkey: new PublicKey(accounts.tokenProgram), isSigner: false, isWritable: false },
            { pubkey: new PublicKey(accounts.systemProgram), isSigner: false, isWritable: false },
            // rest (order matters)
            { pubkey: new PublicKey(accounts.shieldedVaultIn), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(accounts.reserveIn), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(accounts.reserveOut), isSigner: false, isWritable: true },
            { pubkey: new PublicKey(accounts.recipientToken), isSigner: false, isWritable: true },
        ],
        data: ixData
    });
}
