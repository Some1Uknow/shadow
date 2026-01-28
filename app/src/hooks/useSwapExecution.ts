import { useCallback, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { useProgram } from '@/hooks/useProgram';
import { UsePoolDataOptions } from '@/hooks/swr/usePoolData'; // Assuming we need types or we pass poolConfig
import {
    COMPUTE_UNITS,
    PRIORITY_FEE_MICROLAMPORTS,
    LAMPORTS_MULTIPLIER,
} from '@/lib/constants';
import { SwapDirection } from '@/types/swap';

import { PoolConfig } from '@/types/pool';

interface UseSwapExecutionProps {
    poolConfig: PoolConfig | null; // We'll infer this or import it properly
    generateAllProofs: (amount: number) => Promise<{ proof: Uint8Array; publicInputs: Uint8Array } | null>;
    onSwapComplete?: (txSignature: string) => void;
}

export function useSwapExecution({
    poolConfig,
    generateAllProofs,
    onSwapComplete,
}: UseSwapExecutionProps) {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const { program } = useProgram();

    const [isSwapping, setIsSwapping] = useState(false);

    const executeSwap = useCallback(
        async (
            amountIn: number,
            minOutput: number,
            direction: SwapDirection,
            onError: (message: string) => void,
            onSuccess: (signature: string) => void
        ) => {
            if (!publicKey || !signTransaction || !program || !poolConfig) {
                onError('Wallet not connected or pool not loaded');
                return;
            }
            if (amountIn <= 0) {
                onError('Enter a valid amount');
                return;
            }

            setIsSwapping(true);

            try {
                // 1. Generate Proofs
                const proof = await generateAllProofs(amountIn);
                if (!proof) throw new Error('Failed to generate proofs');

                // 2. Prepare Amounts
                const amountInLamports = new BN(Math.floor(amountIn * LAMPORTS_MULTIPLIER));
                const minOutLamports = new BN(Math.floor(minOutput * LAMPORTS_MULTIPLIER));

                // 3. Get Token Accounts
                const userTokenA = await getAssociatedTokenAddress(poolConfig.tokenAMint, publicKey);
                const userTokenB = await getAssociatedTokenAddress(poolConfig.tokenBMint, publicKey);

                // 4. Build Transaction
                const transactionBuilder =
                    direction === 'AtoB'
                        ? program.methods.zkSwap(
                            amountInLamports,
                            minOutLamports,
                            Buffer.from(proof.proof),
                            Buffer.from(proof.publicInputs)
                        )
                        : program.methods.zkSwapReverse(
                            amountInLamports,
                            minOutLamports,
                            Buffer.from(proof.proof),
                            Buffer.from(proof.publicInputs)
                        );

                const tx = await transactionBuilder
                    .accounts({
                        pool: poolConfig.poolPda,
                        userTokenA,
                        userTokenB,
                        tokenAReserve: poolConfig.tokenAReserve,
                        tokenBReserve: poolConfig.tokenBReserve,
                        user: publicKey,
                        verifierProgram: poolConfig.verifierProgramId,
                        verifierState: poolConfig.verifierState,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .transaction();

                // 5. Add Compute Budget
                const { ComputeBudgetProgram } = await import('@solana/web3.js');
                tx.instructions.unshift(
                    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }),
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICROLAMPORTS })
                );

                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                tx.recentBlockhash = blockhash;
                tx.feePayer = publicKey;

                // 6. Sign and Send
                const signedTx = await signTransaction(tx);

                let signature: string;
                try {
                    signature = await connection.sendRawTransaction(signedTx.serialize());
                } catch (sendErr: any) {
                    if (sendErr.message && sendErr.message.includes('already been processed')) {
                        if (signedTx.signatures && signedTx.signatures.length > 0 && signedTx.signatures[0].signature) {
                            const bs58 = (await import('bs58')).default;
                            signature = bs58.encode(signedTx.signatures[0].signature);
                        } else {
                            throw sendErr;
                        }
                    } else {
                        throw sendErr;
                    }
                }

                await connection.confirmTransaction({
                    signature,
                    blockhash,
                    lastValidBlockHeight
                }, 'confirmed');

                onSuccess(signature);
                onSwapComplete?.(signature);
            } catch (err: any) {
                let message = err instanceof Error ? err.message : 'Swap failed';

                // Map common errors
                if (message.includes('insufficient funds') || message.includes('0x1')) {
                    message = 'Insufficient liquidity. Try a smaller amount.';
                } else if (message.includes('SlippageExceeded') || message.includes('0x1770')) {
                    message = 'Slippage exceeded. Try increasing tolerance.';
                } else if (message.includes('already been processed')) {
                    
                }

                onError(message);
            } finally {
                setIsSwapping(false);
            }
        },
        [
            publicKey,
            signTransaction,
            program,
            poolConfig,
            connection,
            generateAllProofs,
            onSwapComplete,
        ]
    );

    return {
        isSwapping,
        executeSwap,
    };
}
