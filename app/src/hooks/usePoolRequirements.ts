'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { usePool } from './usePool';
import {
  useZKProofMulti,
  CircuitType,
  MinBalanceInputs,
  TokenHolderInputs,
  ExclusionInputs,
} from './useZKProof';


/** Requirement types that a pool can enforce */
export type RequirementType = 'min_balance' | 'token_holder' | 'exclusion';

/** Base requirement interface */
interface BaseRequirement {
  type: RequirementType;
  enabled: boolean;
  description: string;
}

/** Min balance requirement - user must hold >= threshold of swap token */
export interface MinBalanceRequirement extends BaseRequirement {
  type: 'min_balance';
  threshold: number; // In token units (not lamports)
}

/** Token holder requirement - user must hold >= min of a specific token */
export interface TokenHolderRequirement extends BaseRequirement {
  type: 'token_holder';
  tokenMint: string;
  tokenSymbol: string;
  minRequired: number; // In token units
}

/** Exclusion requirement - user must NOT be on blacklist */
export interface ExclusionRequirement extends BaseRequirement {
  type: 'exclusion';
  blacklistRoot: string;
  blacklistName: string;
}

export type PoolRequirement = MinBalanceRequirement | TokenHolderRequirement | ExclusionRequirement;

/** Status of a single requirement check */
export interface RequirementStatus {
  requirement: PoolRequirement;
  met: boolean;
  checking: boolean;
  error: string | null;
  userValue?: number | string; // User's actual value (balance, etc.)
  proofGenerated: boolean;
}

/** Overall pool requirements state */
export interface PoolRequirementsState {
  requirements: RequirementStatus[];
  allMet: boolean;
  anyChecking: boolean;
  proofs: Map<RequirementType, { proof: Uint8Array; publicInputs: Uint8Array }>;
}


/**
 * Get pool requirements from environment or defaults
 * In production, this would come from on-chain pool config
 */
export function getPoolRequirements(): PoolRequirement[] {
  // Check environment for custom requirements
  const customRequirements = process.env.NEXT_PUBLIC_POOL_REQUIREMENTS;
  if (customRequirements) {
    try {
      return JSON.parse(customRequirements);
    } catch {
      console.warn('Failed to parse NEXT_PUBLIC_POOL_REQUIREMENTS');
    }
  }

  // Default requirements for the demo pool
  return [
    {
      type: 'min_balance',
      enabled: true,
      description: 'Minimum balance to swap',
      threshold: 0.1, // 0.1 tokens minimum
    },

  ];
}


/**
 * Hook to check and enforce pool requirements
 * Automatically checks user eligibility and generates required proofs
 */
export function usePoolRequirements() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { config: poolConfig } = usePool();
  const {
    generateMinBalanceProof,
    generateTokenHolderProof,
    generateExclusionProof,
    getEmptyTreeInputs,
    isGenerating,
    error: proofError,
    reset: resetProofs,
  } = useZKProofMulti();

  // State
  const [requirements] = useState<PoolRequirement[]>(() =>
    getPoolRequirements().filter(r => r.enabled)
  );
  const [statuses, setStatuses] = useState<RequirementStatus[]>([]);
  const [proofs, setProofs] = useState<Map<RequirementType, { proof: Uint8Array; publicInputs: Uint8Array }>>(new Map());
  const [isCheckingAll, setIsCheckingAll] = useState(false);

  // Initialize statuses when requirements change
  useEffect(() => {
    setStatuses(requirements.map(req => ({
      requirement: req,
      met: false,
      checking: false,
      error: null,
      proofGenerated: false,
    })));
  }, [requirements]);

  /**
   * Check a single requirement
   */
  const checkRequirement = useCallback(async (
    requirement: PoolRequirement,
    swapAmount: number
  ): Promise<{ met: boolean; userValue?: number | string; error?: string }> => {
    if (!publicKey || !connection) {
      return { met: false, error: 'Wallet not connected' };
    }

    try {
      switch (requirement.type) {
        case 'min_balance': {
          // Get user's balance of the swap token
          if (!poolConfig) return { met: false, error: 'Pool not configured' };

          const ata = await getAssociatedTokenAddress(poolConfig.tokenAMint, publicKey);
          try {
            const account = await getAccount(connection, ata);
            const balance = Number(account.amount) / 1e9;
            const threshold = Math.max(requirement.threshold, swapAmount);
            return {
              met: balance >= threshold,
              userValue: balance,
              error: balance < threshold ? `Need ${threshold} tokens, have ${balance.toFixed(4)}` : undefined
            };
          } catch {
            return { met: false, userValue: 0, error: 'No token account found' };
          }
        }

        case 'token_holder': {
          // Get user's balance of the required token
          try {
            const mintPubkey = new PublicKey(requirement.tokenMint);
            const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
            const account = await getAccount(connection, ata);
            const balance = Number(account.amount) / 1e9;
            return {
              met: balance >= requirement.minRequired,
              userValue: balance,
              error: balance < requirement.minRequired
                ? `Need ${requirement.minRequired} ${requirement.tokenSymbol}, have ${balance.toFixed(4)}`
                : undefined
            };
          } catch {
            return {
              met: false,
              userValue: 0,
              error: `No ${requirement.tokenSymbol} token account found`
            };
          }
        }

        case 'exclusion': {
          // For exclusion, we assume user is NOT blacklisted unless proven otherwise
          // In production, you'd check against an actual blacklist service
          return { met: true, userValue: 'Not blacklisted' };
        }

        default:
          return { met: false, error: 'Unknown requirement type' };
      }
    } catch (err) {
      return { met: false, error: err instanceof Error ? err.message : 'Check failed' };
    }
  }, [publicKey, connection, poolConfig]);

  /**
   * Check all requirements for a given swap amount
   */
  const checkAllRequirements = useCallback(async (swapAmount: number) => {
    if (!publicKey || requirements.length === 0) return;

    setIsCheckingAll(true);

    const newStatuses = await Promise.all(
      requirements.map(async (req) => {
        const result = await checkRequirement(req, swapAmount);
        return {
          requirement: req,
          met: result.met,
          checking: false,
          error: result.error || null,
          userValue: result.userValue,
          proofGenerated: false,
        };
      })
    );

    setStatuses(newStatuses);
    setIsCheckingAll(false);
  }, [publicKey, requirements, checkRequirement]);

  /**
   * Generate all required proofs and return the primary proof
   * Returns the proof directly to avoid React state timing issues
   */
  const generateAllProofs = useCallback(async (swapAmount: number): Promise<{ proof: Uint8Array; publicInputs: Uint8Array } | null> => {
    if (!publicKey || !poolConfig) return null;

    const newProofs = new Map<RequirementType, { proof: Uint8Array; publicInputs: Uint8Array }>();
    const newStatuses = [...statuses];
    let primaryProof: { proof: Uint8Array; publicInputs: Uint8Array } | null = null;

    for (let i = 0; i < requirements.length; i++) {
      const req = requirements[i];
      const status = statuses[i];

      if (!status?.met) {

        return null;
      }

      // Update status to show generating
      newStatuses[i] = { ...status, checking: true };
      setStatuses([...newStatuses]);

      try {
        let result: { proof: Uint8Array; publicInputs: Uint8Array } | null = null;

        switch (req.type) {
          case 'min_balance': {
            const minReq = req as MinBalanceRequirement;
            const threshold = Math.max(minReq.threshold, swapAmount);
            const inputs: MinBalanceInputs = {
              balance: status.userValue as number,
              threshold,
            };
            const proofResult = await generateMinBalanceProof(inputs);
            if (proofResult) {
              result = { proof: proofResult.proof, publicInputs: proofResult.publicInputs };

            }
            break;
          }

          case 'token_holder': {
            const tokenReq = req as TokenHolderRequirement;
            const inputs: TokenHolderInputs = {
              token_amount: Math.floor((status.userValue as number) * 1e9).toString(),
              user_address: publicKey.toBase58(),
              token_mint: tokenReq.tokenMint,
              min_required: Math.floor(tokenReq.minRequired * 1e9).toString(),
            };
            const proofResult = await generateTokenHolderProof(inputs);
            if (proofResult) {
              result = { proof: proofResult.proof, publicInputs: proofResult.publicInputs };
            }
            break;
          }

          case 'exclusion': {
            const exclReq = req as ExclusionRequirement;
            let inputs: ExclusionInputs;

            if (exclReq.blacklistRoot === '0x0') {
              // Empty tree (testing)
              const emptyInputs = await getEmptyTreeInputs(publicKey.toBase58());
              if (!emptyInputs) throw new Error('Failed to get empty tree inputs');
              inputs = emptyInputs;
            } else {
              // Real blacklist - would need to fetch merkle proof from service
              inputs = {
                address: publicKey.toBase58(),
                path_indices: new Array(32).fill('0'),
                sibling_path: new Array(32).fill('0'),
                root: exclReq.blacklistRoot,
              };
            }

            const proofResult = await generateExclusionProof(inputs);
            if (proofResult) {
              result = { proof: proofResult.proof, publicInputs: proofResult.publicInputs };
            }
            break;
          }
        }

        if (result) {
          newProofs.set(req.type, result);
          newStatuses[i] = { ...newStatuses[i], checking: false, proofGenerated: true };
          // Store the first proof as primary
          if (i === 0) {
            primaryProof = result;
          }
        } else {
          newStatuses[i] = { ...newStatuses[i], checking: false, error: 'Proof generation failed' };
          setStatuses([...newStatuses]);
          return null;
        }
      } catch (err) {

        newStatuses[i] = {
          ...newStatuses[i],
          checking: false,
          error: err instanceof Error ? err.message : 'Proof generation failed'
        };
        setStatuses([...newStatuses]);
        return null;
      }
    }

    setStatuses(newStatuses);
    setProofs(newProofs);

    // Return the primary proof directly
    return primaryProof;
  }, [
    publicKey,
    poolConfig,
    requirements,
    statuses,
    generateMinBalanceProof,
    generateTokenHolderProof,
    generateExclusionProof,
    getEmptyTreeInputs,
  ]);

  /**
   * Get the primary proof for swap (first requirement's proof)
   * Note: Use the return value from generateAllProofs instead for immediate access
   */
  const getPrimaryProof = useCallback(() => {
    if (requirements.length === 0) return null;
    return proofs.get(requirements[0].type) || null;
  }, [requirements, proofs]);

  /**
   * Reset all proofs and statuses
   */
  const reset = useCallback(() => {
    resetProofs();
    setProofs(new Map());
    setStatuses(requirements.map(req => ({
      requirement: req,
      met: false,
      checking: false,
      error: null,
      proofGenerated: false,
    })));
  }, [requirements, resetProofs]);

  // Computed state
  const allMet = useMemo(() =>
    statuses.length > 0 && statuses.every(s => s.met),
    [statuses]
  );

  const allProofsGenerated = useMemo(() =>
    statuses.length > 0 && statuses.every(s => s.proofGenerated),
    [statuses]
  );

  const anyChecking = useMemo(() =>
    isCheckingAll || statuses.some(s => s.checking) || isGenerating,
    [isCheckingAll, statuses, isGenerating]
  );

  return {
    // Requirements
    requirements,
    statuses,

    // State
    allMet,
    allProofsGenerated,
    anyChecking,
    proofError,

    // Actions
    checkAllRequirements,
    generateAllProofs,
    getPrimaryProof,
    reset,

    // Proofs map
    proofs,
  };
}
