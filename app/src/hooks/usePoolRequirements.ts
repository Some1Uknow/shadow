'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { usePool } from './usePool';
import {
  useZKProofMulti,
  MinBalanceInputs,
  TokenHolderInputs,
  ExclusionInputs,
} from './useZKProof';
import {
  PoolRequirement,
  RequirementStatus,
  RequirementType,
  MinBalanceRequirement,
  TokenHolderRequirement,
  ExclusionRequirement,
} from '@/types/pool';
import { ProofGenerationError } from '@/lib/errors';
import { ProofMode, getProofModeConfig, DEFAULT_PROOF_MODE, getSavedProofMode, saveProofMode, EMPTY_TREE_ROOT } from '@/lib/proof-modes';

// Types

/** Overall pool requirements state */
export interface PoolRequirementsState {
  requirements: RequirementStatus[];
  allMet: boolean;
  anyChecking: boolean;
  proofs: Map<RequirementType, { proof: Uint8Array; publicInputs: Uint8Array }>;
}

/** Proof result type */
interface ProofResult {
  proof: Uint8Array;
  publicInputs: Uint8Array;
}

export interface GeneratedProofs {
  primary: ProofResult | null;
  proofs: Map<RequirementType, ProofResult>;
}

// Hook

/**
 * Hook to check and enforce pool requirements
 * Automatically checks user eligibility and generates required proofs
 * 
 * @param initialMode - Optional initial proof mode (defaults to saved or DEFAULT_PROOF_MODE)
 */
export function usePoolRequirements(initialMode?: ProofMode) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { config: poolConfig } = usePool();
  const {
    generateMinBalanceProof,
    generateTokenHolderProof,
    generateExclusionProof,
    isGenerating,
    error: proofError,
    reset: resetProofs,
  } = useZKProofMulti();

  // Proof mode state
  const [proofMode, setProofModeState] = useState<ProofMode>(() => {
    if (initialMode) return initialMode;
    // Only access localStorage on client
    if (typeof window !== 'undefined') {
      return getSavedProofMode();
    }
    return DEFAULT_PROOF_MODE;
  });

  // Get requirements based on current proof mode
  const requirements = useMemo(() => {
    const config = getProofModeConfig(proofMode);
    return config.requirements.filter((r) => r.enabled);
  }, [proofMode]);

  // State
  const [statuses, setStatuses] = useState<RequirementStatus[]>([]);
  const [proofs, setProofs] = useState<Map<RequirementType, ProofResult>>(new Map());
  const [isCheckingAll, setIsCheckingAll] = useState(false);

  // Update proof mode and persist
  const setProofMode = useCallback((mode: ProofMode) => {
    setProofModeState(mode);
    saveProofMode(mode);
    // Reset statuses when mode changes
    setStatuses([]);
    setProofs(new Map());
  }, []);

  // Initialize statuses when requirements change
  useEffect(() => {
    setStatuses(
      requirements.map((req) => ({
        requirement: req,
        met: false,
        checking: false,
        error: null,
        proofGenerated: false,
      }))
    );
  }, [requirements]);

  /**
   * Check a single requirement
   */
  const checkRequirement = useCallback(
    async (
      requirement: PoolRequirement,
      swapAmount: number,
      swapMint?: PublicKey
    ): Promise<{ met: boolean; userValue?: number | string; error?: string }> => {
      if (!publicKey || !connection) {
        return { met: false, error: 'Wallet not connected' };
      }

      try {
        switch (requirement.type) {
          case 'min_balance': {
            const minReq = requirement as MinBalanceRequirement;
            // Get user's balance of the swap token
            if (!poolConfig) return { met: false, error: 'Pool not configured' };

            const mint = swapMint ?? poolConfig.tokenAMint;
            const ata = await getAssociatedTokenAddress(mint, publicKey);
            try {
              const account = await getAccount(connection, ata);
              const balance = Number(account.amount) / 1e9;
              const threshold = Math.max(minReq.threshold, swapAmount);
              return {
                met: balance >= threshold,
                userValue: balance,
                error:
                  balance < threshold
                    ? `Need ${threshold} tokens, have ${balance.toFixed(4)}`
                    : undefined,
              };
            } catch {
              return { met: false, userValue: 0, error: 'No token account found' };
            }
          }

          case 'token_holder': {
            const tokenReq = requirement as TokenHolderRequirement;
            // Get user's balance of the required token
            try {
              const mintPubkey = new PublicKey(tokenReq.tokenMint);
              const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
              const account = await getAccount(connection, ata);
              const balance = Number(account.amount) / 1e9;
              return {
                met: balance >= tokenReq.minRequired,
                userValue: balance,
                error:
                  balance < tokenReq.minRequired
                    ? `Need ${tokenReq.minRequired} ${tokenReq.tokenSymbol}, have ${balance.toFixed(
                      4
                    )}`
                    : undefined,
              };
            } catch {
              return {
                met: false,
                userValue: 0,
                error: `No ${tokenReq.tokenSymbol} token account found`,
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
        return {
          met: false,
          error: err instanceof Error ? err.message : 'Check failed',
        };
      }
    },
    [publicKey, connection, poolConfig]
  );

  /**
   * Check all requirements for a given swap amount
   */
  const checkAllRequirements = useCallback(
    async (swapAmount: number, swapMint?: PublicKey) => {
      if (!publicKey || requirements.length === 0) return;

      setIsCheckingAll(true);

      const newStatuses = await Promise.all(
        requirements.map(async (req) => {
          const result = await checkRequirement(req, swapAmount, swapMint);
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
    },
    [publicKey, requirements, checkRequirement]
  );

  /**
   * Generate all required proofs and return the primary proof
   * Returns the proof directly to avoid React state timing issues
   */
  const generateAllProofs = useCallback(
    async (swapAmount: number, swapMint?: PublicKey): Promise<GeneratedProofs | null> => {
      if (!publicKey || !poolConfig) return null;

      const newProofs = new Map<RequirementType, ProofResult>();
      const newStatuses = [...statuses];
      let primaryProof: ProofResult | null = null;

      console.log('Generating proofs for requirements:', requirements.map(r => r.type));

      for (let i = 0; i < requirements.length; i++) {
        const req = requirements[i];
        const status = statuses[i];

        if (!status?.met) {
          console.log(`Requirement ${req.type} not met, aborting proofs`);
          return null;
        }

        // Update status to show generating
        newStatuses[i] = { ...status, checking: true };
        setStatuses([...newStatuses]);

        try {
          let result: ProofResult | null = null;
          console.log(`Generating proof for ${req.type}...`);

          switch (req.type) {
            case 'min_balance': {
              const minReq = req as MinBalanceRequirement;
              const threshold = Math.max(minReq.threshold, swapAmount);
              const inputs: MinBalanceInputs = {
                owner: publicKey.toBase58(),
                token_mint: (swapMint ?? poolConfig?.tokenAMint)?.toBase58() || '',
                threshold,
              };
              const proofResult = await generateMinBalanceProof(inputs);
              if (proofResult) {
                result = {
                  proof: proofResult.proof,
                  publicInputs: proofResult.publicInputs,
                };
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
                result = {
                  proof: proofResult.proof,
                  publicInputs: proofResult.publicInputs,
                };
              }
              break;
            }

            case 'exclusion': {
              const exclReq = req as ExclusionRequirement;
              const inputs: ExclusionInputs = {
                address: publicKey.toBase58(),
                blacklist_root: exclReq.blacklistRoot === EMPTY_TREE_ROOT ? "0" : exclReq.blacklistRoot,
              };

              const proofResult = await generateExclusionProof(inputs);
              if (proofResult) {
                result = {
                  proof: proofResult.proof,
                  publicInputs: proofResult.publicInputs,
                };
              }
              break;
            }
          }

          if (result) {
            console.log(`Generated proof for ${req.type}. Inputs length: ${result.publicInputs.length}`);
            newProofs.set(req.type, result);
            newStatuses[i] = {
              ...newStatuses[i],
              checking: false,
              proofGenerated: true,
            };
            // Store the first proof as primary (used for on-chain verification)
            if (i === 0) {
              primaryProof = result;
              console.log(`Set PRIMARY PROOF to ${req.type}`);
            }
          } else {
            console.error(`Result null for ${req.type}`);
            const error = new ProofGenerationError('Proof generation returned null result from API');
            newStatuses[i] = {
              ...newStatuses[i],
              checking: false,
              error: error.message,
            };
            setStatuses([...newStatuses]);
            return null;
          }
        } catch (err) {
          console.error(`Error generating ${req.type}:`, err);
          const errorMsg = err instanceof Error ? err.message : 'Proof generation failed';
          const proofError = new ProofGenerationError(errorMsg, err);

          newStatuses[i] = {
            ...newStatuses[i],
            checking: false,
            error: proofError.message,
          };
          setStatuses([...newStatuses]);
          return null;
        }
      }

      setStatuses(newStatuses);
      setProofs(newProofs);

      return {
        primary: primaryProof,
        proofs: newProofs,
      };
    },
    [
      publicKey,
      poolConfig,
      requirements,
      statuses,
      generateMinBalanceProof,
      generateTokenHolderProof,
      generateExclusionProof,
    ]
  );

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
    setStatuses(
      requirements.map((req) => ({
        requirement: req,
        met: false,
        checking: false,
        error: null,
        proofGenerated: false,
      }))
    );
  }, [requirements, resetProofs]);

  // Computed state
  const allMet = useMemo(() => {
    if (requirements.length === 0) return true;
    return statuses.length > 0 && statuses.every((s) => s.met);
  }, [requirements.length, statuses]);

  const allProofsGenerated = useMemo(() => {
    if (requirements.length === 0) return true;
    return statuses.length > 0 && statuses.every((s) => s.proofGenerated);
  }, [requirements.length, statuses]);

  const anyChecking = useMemo(
    () => isCheckingAll || statuses.some((s) => s.checking) || isGenerating,
    [isCheckingAll, statuses, isGenerating]
  );

  return {
    // Proof mode
    proofMode,
    setProofMode,
    proofModeConfig: getProofModeConfig(proofMode),

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
