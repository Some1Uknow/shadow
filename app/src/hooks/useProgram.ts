'use client';

import { useMemo } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { getPoolConfig } from './usePool';
import { ZkgateIDL, IDL } from '@/types/program';
import { PoolConfig } from '@/types/pool';

// Program ID from environment or fallback to deployed devnet ID
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || 'GVkWHzgYaUDmM5KF4uHv7fM9DEtDtqpsF8T3uHbSYR2d'
);

export interface UseProgramReturn {
  program: Program<ZkgateIDL> | null;
  provider: AnchorProvider | null;
  poolPda: PublicKey | null;
  programId: PublicKey;
  poolConfig: PoolConfig | null;
}

/**
 * Hook to access the Anchor program
 */
export function useProgram(): UseProgramReturn {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const provider = useMemo(() => {
    if (!connection || !wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program<ZkgateIDL>(IDL as ZkgateIDL, provider);
  }, [provider]);

  // Get pool configuration from environment
  const poolConfig = useMemo(() => getPoolConfig(), []);

  // Pool PDA from config or computed
  const poolPda = useMemo(() => {
    if (poolConfig?.poolPda) {
      return poolConfig.poolPda;
    }
    return null;
  }, [poolConfig]);

  return {
    program,
    provider,
    poolPda,
    programId: PROGRAM_ID,
    poolConfig,
  };
}

/**
 * Compute pool PDA for given token mints
 */
export function getPoolPda(tokenAMint: PublicKey, tokenBMint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), tokenAMint.toBuffer(), tokenBMint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}
