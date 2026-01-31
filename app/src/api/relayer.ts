export interface RelayerRequest {
    proof: Uint8Array;
    publicInputs: Uint8Array;
    instructionData: Buffer; // The serialized Anchor instruction
    eligibilityProofs?: Array<{
        type: string;
        proof: number[];
        publicInputs: number[];
    }>;
    requireEligibility?: boolean;
    accounts: Record<string, string>; // Map of account names to Pubkeys
}

export interface RelayerResponse {
    signature: string;
    success: boolean;
    error?: string;
    details?: unknown;
    logs?: string[];
    debug?: Record<string, unknown>;
}

export class RelayerService {
    private static ENDPOINT = '/api/relayer';

    static async submitTransaction(req: RelayerRequest): Promise<RelayerResponse> {
        try {
            const response = await fetch(this.ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    proof: Array.from(req.proof),
                    publicInputs: Array.from(req.publicInputs),
                    instructionData: req.instructionData.toString('base64'),
                    eligibilityProofs: req.eligibilityProofs,
                    requireEligibility: req.requireEligibility,
                    accounts: req.accounts,
                }),
            });

            return await response.json();
        } catch (error) {
            console.error('Relayer submission failed:', error);
            return {
                success: false,
                signature: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
