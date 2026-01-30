/**
 * Shielded note creation (server-side).
 * Returns secret + nullifier + commitment for a given amount/mint/pool.
 */

import { NextRequest, NextResponse } from 'next/server';
import { poseidonHash, randomField } from '@/lib/poseidon';

export async function POST(req: NextRequest) {
    try {
        const { amount, mintField, poolField } = await req.json();
        if (!amount || !mintField || !poolField) {
            return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 });
        }

        const secret = randomField();
        const nullifier = randomField();
        const commitment = await poseidonHash([amount, secret, nullifier, mintField, poolField]);

        return NextResponse.json({
            success: true,
            note: { amount, secret, nullifier, commitment },
        });
    } catch (e) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
    }
}
