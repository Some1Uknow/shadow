/**
 * Token Holder Proof API
 * 
 * LIMITATION: Sunspot has issues with large hex values from Pedersen hashes.
 * Using simplified binding for demo. Production should use Pedersen commitments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import bs58 from 'bs58';

const execAsync = promisify(exec);

const PROJECT_ROOT = path.join(process.cwd(), '..');
const CIRCUIT_DIR = path.join(PROJECT_ROOT, 'circuits', 'token_holder');
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

export async function POST(request: NextRequest) {
    try {
        const { token_amount, user_address, token_mint, min_required } = await request.json();

        if (!token_amount || !user_address || !token_mint || !min_required) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const tokenAmountNum = parseFloat(token_amount);
        const minRequiredNum = parseFloat(min_required);

        if (tokenAmountNum < minRequiredNum) {
            return NextResponse.json({ 
                error: 'Insufficient token holdings',
                details: `Have ${token_amount}, need ${min_required}`
            }, { status: 400 });
        }

        if (!await commandExists('nargo') || !await commandExists('sunspot')) {
            return NextResponse.json({ error: 'nargo or sunspot not found' }, { status: 500 });
        }

        const userAddressField = addressToField(user_address);
        const tokenMintField = addressToField(token_mint);

        const proverContent = `token_amount = "${token_amount}"
user_address = "${userAddressField}"
token_mint = "${tokenMintField}"
min_required = "${min_required}"`;

        await fs.writeFile(path.join(CIRCUIT_DIR, 'Prover.toml'), proverContent);

        try {
            await execAsync(`cd ${CIRCUIT_DIR} && nargo execute`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('assertion')) {
                return NextResponse.json({ error: 'Token holding verification failed' }, { status: 400 });
            }
            return NextResponse.json({ error: 'Witness generation failed', details: msg }, { status: 500 });
        }

        const ccsPath = path.join(TARGET_DIR, 'token_holder.ccs');
        const pkPath = path.join(TARGET_DIR, 'token_holder.pk');
        
        try { await fs.access(ccsPath); } catch {
            await execAsync(`cd ${CIRCUIT_DIR} && sunspot compile target/token_holder.json`);
        }
        try { await fs.access(pkPath); } catch {
            await execAsync(`cd ${CIRCUIT_DIR} && sunspot setup target/token_holder.ccs`);
        }

        try {
            await execAsync(`cd ${CIRCUIT_DIR} && sunspot prove target/token_holder.json target/token_holder.gz target/token_holder.ccs target/token_holder.pk`);
        } catch (e) {
            return NextResponse.json({ error: 'Proof generation failed', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
        }

        const proofBytes = await fs.readFile(path.join(TARGET_DIR, 'token_holder.proof'));
        const pwBytes = await fs.readFile(path.join(TARGET_DIR, 'token_holder.pw'));

        return NextResponse.json({
            success: true,
            circuit: 'token_holder',
            proof: Array.from(proofBytes),
            publicInputs: Array.from(pwBytes),
            metadata: { token_mint, min_required }
        });

    } catch (error) {
        return NextResponse.json({ error: 'Internal error', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        circuit: 'token_holder',
        description: 'Proves token ownership >= minimum (simplified for Sunspot compatibility)',
        inputs: { private: ['token_amount', 'user_address'], public: ['token_mint', 'min_required'] },
    });
}
