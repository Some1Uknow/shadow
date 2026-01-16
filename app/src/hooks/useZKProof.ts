'use client';

import { useState, useCallback } from 'react';

interface ProofInputs {
  balance: number;
  threshold: number;
}

interface ProofResult {
  proof: Uint8Array;
  publicInputs: Uint8Array;
}

interface ProofContext {
  balance: number;      // Balance used for proof (in token units, not lamports)
  threshold: number;    // Threshold proved against
  generatedAt: number;  // Timestamp when proof was generated
}

/**
 * Hook for generating ZK proofs using server-side Sunspot Groth16 prover
 * 
 * This calls the /api/prove endpoint which runs `sunspot prove` to generate
 * Groth16 proofs that can be verified on-chain by the deployed Sunspot verifier.
 */
export function useZKProof() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [proof, setProof] = useState<ProofResult | null>(null);
  const [proofContext, setProofContext] = useState<ProofContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateProof = useCallback(async (inputs: ProofInputs): Promise<ProofResult | null> => {
    setIsGenerating(true);
    setError(null);
    setProof(null);

    try {
      // Convert balance to token units (with 9 decimals)
      const balanceUnits = Math.floor(inputs.balance * 1e9).toString();
      const thresholdUnits = Math.floor(inputs.threshold * 1e9).toString();

      console.log('[useZKProof] Calling /api/prove with:', {
        balance: balanceUnits,
        threshold: thresholdUnits
      });

      const response = await fetch('/api/prove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          balance: balanceUnits,
          threshold: thresholdUnits,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Proof generation failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Proof generation failed');
      }

      const result: ProofResult = {
        proof: new Uint8Array(data.proof),
        publicInputs: new Uint8Array(data.publicInputs),
      };

      console.log('[useZKProof] Proof generated successfully!');
      console.log('[useZKProof] Proof size:', result.proof.length, 'bytes');
      console.log('[useZKProof] Public inputs size:', result.publicInputs.length, 'bytes');

      setProof(result);
      setProofContext({
        balance: inputs.balance,
        threshold: inputs.threshold,
        generatedAt: Date.now(),
      });
      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useZKProof] Error:', message);
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProof(null);
    setProofContext(null);
    setError(null);
  }, []);

  return {
    generateProof,
    isGenerating,
    proof,
    proofContext,
    error,
    reset,
    // Always ready since we use server-side generation
    isInitialized: true,
  };
}
