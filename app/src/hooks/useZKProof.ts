'use client';

import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

/** Available circuit types */
export type CircuitType = 'min_balance' | 'token_holder' | 'smt_exclusion';

/** Base proof result */
interface ProofResult {
  proof: Uint8Array;
  publicInputs: Uint8Array;
  circuit: CircuitType;
}

/** Min Balance circuit inputs */
export interface MinBalanceInputs {
  balance: number;
  threshold: number;
}

/** Token Holder circuit inputs */
export interface TokenHolderInputs {
  token_amount: string;      // Token amount as string (to handle large numbers)
  user_address: string;      // User's wallet address (hex)
  token_mint: string;        // Token mint address (hex)
  min_required: string;      // Minimum required tokens as string
}

/** SMT Exclusion circuit inputs */
export interface ExclusionInputs {
  address: string;           // Address to prove exclusion for (hex)
  path_indices: string[];    // Path directions (32 elements, each "0" or "1")
  sibling_path: string[];    // Merkle path siblings (32 elements)
  root: string;              // Blacklist merkle root (hex)
}

/** Union type for all circuit inputs */
export type CircuitInputs = 
  | { type: 'min_balance'; inputs: MinBalanceInputs }
  | { type: 'token_holder'; inputs: TokenHolderInputs }
  | { type: 'smt_exclusion'; inputs: ExclusionInputs };

/** Proof context with circuit-specific metadata */
export interface ProofContext {
  circuit: CircuitType;
  generatedAt: number;
  // Circuit-specific context
  minBalance?: {
    balance: number;
    threshold: number;
  };
  tokenHolder?: {
    token_mint: string;
    min_required: string;
  };
  exclusion?: {
    root: string;
  };
}

/** Circuit metadata for UI */
export interface CircuitInfo {
  type: CircuitType;
  name: string;
  description: string;
  useCases: string[];
  privateInputs: string[];
  publicInputs: string[];
}

// ============================================================================
// Circuit Metadata
// ============================================================================

export const CIRCUIT_INFO: Record<CircuitType, CircuitInfo> = {
  min_balance: {
    type: 'min_balance',
    name: 'Min Balance',
    description: 'Proves balance ≥ threshold without revealing actual balance',
    useCases: ['Pool access', 'Tier verification', 'Eligibility checks'],
    privateInputs: ['balance'],
    publicInputs: ['threshold'],
  },
  token_holder: {
    type: 'token_holder',
    name: 'Token Holder',
    description: 'Proves ownership of specific token ≥ minimum without revealing amount or address',
    useCases: ['Token-gated access', 'DAO voting eligibility', 'Whale verification'],
    privateInputs: ['token_amount', 'user_address'],
    publicInputs: ['token_mint', 'min_required'],
  },
  smt_exclusion: {
    type: 'smt_exclusion',
    name: 'Blacklist Exclusion',
    description: 'Proves address is NOT on a blacklist without revealing the address',
    useCases: ['Sanctions compliance', 'Anti-sybil', 'Clean wallet verification'],
    privateInputs: ['address', 'path_indices'],
    publicInputs: ['sibling_path', 'root'],
  },
};

// ============================================================================
// Legacy Hook (backwards compatible)
// ============================================================================

interface LegacyProofInputs {
  balance: number;
  threshold: number;
}

interface LegacyProofContext {
  balance: number;
  threshold: number;
  generatedAt: number;
}

/**
 * Legacy hook for min_balance proofs (backwards compatible)
 * 
 * This calls the /api/prove endpoint which runs `sunspot prove` to generate
 * Groth16 proofs that can be verified on-chain by the deployed Sunspot verifier.
 */
export function useZKProof() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [proof, setProof] = useState<ProofResult | null>(null);
  const [proofContext, setProofContext] = useState<LegacyProofContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateProof = useCallback(async (inputs: LegacyProofInputs): Promise<ProofResult | null> => {
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
        circuit: 'min_balance',
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
    isInitialized: true,
  };
}

// ============================================================================
// Multi-Circuit Hook
// ============================================================================

/**
 * Hook for generating ZK proofs for multiple circuit types
 * 
 * Supports:
 * - min_balance: Prove balance ≥ threshold
 * - token_holder: Prove token ownership ≥ minimum
 * - smt_exclusion: Prove address is NOT on blacklist
 */
export function useZKProofMulti() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [proof, setProof] = useState<ProofResult | null>(null);
  const [proofContext, setProofContext] = useState<ProofContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentCircuit, setCurrentCircuit] = useState<CircuitType | null>(null);

  /**
   * Generate a min_balance proof
   */
  const generateMinBalanceProof = useCallback(async (inputs: MinBalanceInputs): Promise<ProofResult | null> => {
    setIsGenerating(true);
    setError(null);
    setProof(null);
    setCurrentCircuit('min_balance');

    try {
      const balanceUnits = Math.floor(inputs.balance * 1e9).toString();
      const thresholdUnits = Math.floor(inputs.threshold * 1e9).toString();

      console.log('[useZKProofMulti] Generating min_balance proof:', { balanceUnits, thresholdUnits });

      const response = await fetch('/api/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: balanceUnits, threshold: thresholdUnits }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || 'Proof generation failed');
      }

      const result: ProofResult = {
        proof: new Uint8Array(data.proof),
        publicInputs: new Uint8Array(data.publicInputs),
        circuit: 'min_balance',
      };

      setProof(result);
      setProofContext({
        circuit: 'min_balance',
        generatedAt: Date.now(),
        minBalance: { balance: inputs.balance, threshold: inputs.threshold },
      });

      console.log('[useZKProofMulti] min_balance proof generated:', result.proof.length, 'bytes');
      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useZKProofMulti] min_balance error:', message);
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  /**
   * Generate a token_holder proof
   */
  const generateTokenHolderProof = useCallback(async (inputs: TokenHolderInputs): Promise<ProofResult | null> => {
    setIsGenerating(true);
    setError(null);
    setProof(null);
    setCurrentCircuit('token_holder');

    try {
      console.log('[useZKProofMulti] Generating token_holder proof:', {
        token_mint: inputs.token_mint.substring(0, 10) + '...',
        min_required: inputs.min_required,
      });

      const response = await fetch('/api/prove/token-holder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || 'Proof generation failed');
      }

      const result: ProofResult = {
        proof: new Uint8Array(data.proof),
        publicInputs: new Uint8Array(data.publicInputs),
        circuit: 'token_holder',
      };

      setProof(result);
      setProofContext({
        circuit: 'token_holder',
        generatedAt: Date.now(),
        tokenHolder: { token_mint: inputs.token_mint, min_required: inputs.min_required },
      });

      console.log('[useZKProofMulti] token_holder proof generated:', result.proof.length, 'bytes');
      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useZKProofMulti] token_holder error:', message);
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  /**
   * Generate an smt_exclusion proof
   */
  const generateExclusionProof = useCallback(async (inputs: ExclusionInputs): Promise<ProofResult | null> => {
    setIsGenerating(true);
    setError(null);
    setProof(null);
    setCurrentCircuit('smt_exclusion');

    try {
      console.log('[useZKProofMulti] Generating smt_exclusion proof:', {
        address: inputs.address.substring(0, 10) + '...',
        root: inputs.root.substring(0, 10) + '...',
      });

      const response = await fetch('/api/prove/exclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || 'Proof generation failed');
      }

      const result: ProofResult = {
        proof: new Uint8Array(data.proof),
        publicInputs: new Uint8Array(data.publicInputs),
        circuit: 'smt_exclusion',
      };

      setProof(result);
      setProofContext({
        circuit: 'smt_exclusion',
        generatedAt: Date.now(),
        exclusion: { root: inputs.root },
      });

      console.log('[useZKProofMulti] smt_exclusion proof generated:', result.proof.length, 'bytes');
      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useZKProofMulti] smt_exclusion error:', message);
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  /**
   * Generate proof for any circuit type
   */
  const generateProof = useCallback(async (circuitInputs: CircuitInputs): Promise<ProofResult | null> => {
    switch (circuitInputs.type) {
      case 'min_balance':
        return generateMinBalanceProof(circuitInputs.inputs);
      case 'token_holder':
        return generateTokenHolderProof(circuitInputs.inputs);
      case 'smt_exclusion':
        return generateExclusionProof(circuitInputs.inputs);
      default:
        setError('Unknown circuit type');
        return null;
    }
  }, [generateMinBalanceProof, generateTokenHolderProof, generateExclusionProof]);

  /**
   * Get empty tree inputs for exclusion proof (for testing)
   */
  const getEmptyTreeInputs = useCallback(async (address: string): Promise<ExclusionInputs | null> => {
    try {
      const response = await fetch('/api/prove/exclusion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get empty tree inputs');
      }

      return data.inputs as ExclusionInputs;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useZKProofMulti] getEmptyTreeInputs error:', message);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setProof(null);
    setProofContext(null);
    setError(null);
    setCurrentCircuit(null);
  }, []);

  return {
    // Proof generation
    generateProof,
    generateMinBalanceProof,
    generateTokenHolderProof,
    generateExclusionProof,
    
    // Helpers
    getEmptyTreeInputs,
    
    // State
    isGenerating,
    proof,
    proofContext,
    error,
    currentCircuit,
    
    // Actions
    reset,
    
    // Always ready since we use server-side generation
    isInitialized: true,
    
    // Circuit metadata
    circuitInfo: CIRCUIT_INFO,
  };
}
