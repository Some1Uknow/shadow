
import { useCallback, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { BN } from '@coral-xyz/anchor';
import { useProgram } from '@/hooks/useProgram';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { LAMPORTS_MULTIPLIER } from '@/lib/constants';

interface UseAddLiquidityReturn {
    addLiquidity: (amountA: number, amountB: number) => Promise<string>;
    isAdding: boolean;
    error: string | null;
}

export function useAddLiquidity(): UseAddLiquidityReturn {
    const { publicKey, signTransaction } = useWallet();
    const { connection } = useConnection();
    const { program, poolConfig } = useProgram();
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addLiquidity = useCallback(async (amountA: number, amountB: number) => {
        if (!publicKey || !signTransaction || !program || !poolConfig) {
            const msg = 'Wallet not connected or pool not loaded';
            setError(msg);
            throw new Error(msg);
        }

        setIsAdding(true);
        setError(null);

        try {
            const amountALamports = new BN(Math.floor(amountA * LAMPORTS_MULTIPLIER));
            const amountBLamports = new BN(Math.floor(amountB * LAMPORTS_MULTIPLIER));

            const userTokenA = await getAssociatedTokenAddress(poolConfig.tokenAMint, publicKey);
            const userTokenB = await getAssociatedTokenAddress(poolConfig.tokenBMint, publicKey);

            const tx = await program.methods
                .addLiquidity(amountALamports, amountBLamports)
                .accounts({
                    pool: poolConfig.poolPda,
                    userTokenA,
                    userTokenB,
                    tokenAReserve: poolConfig.tokenAReserve,
                    tokenBReserve: poolConfig.tokenBReserve,
                    user: publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .transaction();

            tx.feePayer = publicKey;
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;

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

            return signature;
        } catch (err: any) {
            console.error('Add Liquidity Error:', err);
            const msg = err.message || 'Failed to add liquidity';
            setError(msg);
            throw err;
        } finally {
            setIsAdding(false);
        }
    }, [publicKey, signTransaction, program, poolConfig, connection]);

    return { addLiquidity, isAdding, error };
}
