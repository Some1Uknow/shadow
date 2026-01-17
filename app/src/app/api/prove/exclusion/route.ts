/**
 * SMT Exclusion Proof API
 * 
 * LIMITATION: Sunspot has issues with large hex values from Pedersen hashes.
 * Using simplified exclusion check for demo. Production should use full SMT.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import bs58 from 'bs58';

const execAsync = promisify(exec);

const PROJECT_ROOT = path.join(process.cwd(), '..');
const CIRCUIT_DIR = path.join(PROJECT_ROOT, 'circuits', 'smt_exclusion');
const TARGET_DIR = path.join(CIRCUIT_DIR, 'target');

async function commandExists(cmd: string): Promise<boolean> {
    try {
        await execAsync(`which ${cmd}`);
        return true;
    } catch {
        return false;
    }
}

function addressToField(address: string): string {
    try {
        if (/^\d+$/.test(address)) return address;
        if (address.startsWith('0x')) {
            return BigInt('0x' + address.slice(2, 34)).toString();
        }
        const bytes = bs58.decode(address).slice(0, 16);
        let value = BigInt(0);
        for (const byte of bytes) {
            value = (value << BigInt(8)) | BigInt(byte);
        }
        return value.toString();
    } catch {
        let hash = BigInt(0);
        for (let i = 0; i < address.length; i++) {
            hash = ((hash << BigInt(5)) - hash) + BigInt(address.charCodeAt(i));
        }
        return (hash < 0 ? -hash : hash).toString();
    }
}

function generateAddressHash(addressField: string): string {
    const addr = BigInt(addressField);
    const hash = (addr * BigInt(31) + BigInt(17)) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    return hash.toString();
}

export async function POST(request: NextRequest) {
    try {
        const { address, blacklist_root = "0" } = await request.json();

        if (!address) {
            return NextResponse.json({ error: 'Missing address' }, { status: 400 });
        }

        if (!await commandExists('nargo') || !await commandExists('sunspot')) {
            return NextResponse.json({ error: 'nargo or sunspot not found' }, { status: 500 });
        }

        const addressField = addressToField(address);
        const addressHash = generateAddressHash(addressField);

        const proverContent = `address = "${addressField}"
address_hash = "${addressHash}"
blacklist_root = "${blacklist_root}"`;

        await fs.writeFile(path.join(CIRCUIT_DIR, 'Prover.toml'), proverContent);

        try {
            await execAsync(`cd ${CIRCUIT_DIR} && nargo execute`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('assertion')) {
                return NextResponse.json({ error: 'Address may be blacklisted' }, { status: 400 });
            }
            return NextResponse.json({ error: 'Witness generation failed', details: msg }, { status: 500 });
        }

        const ccsPath = path.join(TARGET_DIR, 'smt_exclusion.ccs');
        const pkPath = path.join(TARGET_DIR, 'smt_exclusion.pk');
        
        try { await fs.access(ccsPath); } catch {
            await execAsync(`cd ${CIRCUIT_DIR} && sunspot compile target/smt_exclusion.json`);
        }
        try { await fs.access(pkPath); } catch {
            await execAsync(`cd ${CIRCUIT_DIR} && sunspot setup target/smt_exclusion.ccs`);
        }

        try {
            await execAsync(`cd ${CIRCUIT_DIR} && sunspot prove target/smt_exclusion.json target/smt_exclusion.gz target/smt_exclusion.ccs target/smt_exclusion.pk`);
        } catch (e) {
            return NextResponse.json({ error: 'Proof generation failed', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }

        const proofBytes = await fs.readFile(path.join(TARGET_DIR, 'smt_exclusion.proof'));
        const pwBytes = await fs.readFile(path.join(TARGET_DIR, 'smt_exclusion.pw'));

        return NextResponse.json({
            success: true,
            circuit: 'smt_exclusion',
            proof: Array.from(proofBytes),
            publicInputs: Array.from(pwBytes),
        });

    } catch (error) {
        return NextResponse.json({ error: 'Internal error', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        circuit: 'smt_exclusion',
        description: 'Proves address is NOT on a blacklist (simplified for Sunspot compatibility)',
        inputs: { private: ['address', 'address_hash'], public: ['blacklist_root'] },
    });
}

export async function PUT(request: NextRequest) {
    const { address } = await request.json();
    if (!address) {
        return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }
    const addressField = addressToField(address);
    return NextResponse.json({
        success: true,
        inputs: { address: addressField, address_hash: generateAddressHash(addressField), blacklist_root: "0" }
    });
}
