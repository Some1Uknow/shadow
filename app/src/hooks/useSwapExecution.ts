import { useCallback, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useProgram } from '@/hooks/useProgram';
import type { GeneratedProofs } from '@/hooks/usePoolRequirements';
import {
    COMPUTE_UNITS,
    PRIORITY_FEE_MICROLAMPORTS,
    LAMPORTS_MULTIPLIER,
} from '@/lib/constants';
import { SwapDirection } from '@/types/swap';
import { addressToField, fieldToLeBytes32 } from '@/lib/proof-fields';
import { saveNote } from '@/lib/shielded-note';

import { PoolConfig } from '@/types/pool';

interface UseSwapExecutionProps {
    poolConfig: PoolConfig | null; // We'll infer this or import it properly
    generateAllProofs?: (amount: number, swapMint?: PublicKey) => Promise<GeneratedProofs | null>;
    requiresEligibilityProofs?: boolean;
    onSwapComplete?: (txSignature: string) => void;
}

export function useSwapExecution({
    poolConfig,
    generateAllProofs,
    requiresEligibilityProofs,
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
                const isAtoB = direction === 'AtoB';
                const amountInLamports = new BN(Math.floor(amountIn * LAMPORTS_MULTIPLIER));
                const minOutLamports = new BN(Math.floor(minOutput * LAMPORTS_MULTIPLIER));
                const mintIn = isAtoB ? poolConfig.tokenAMint : poolConfig.tokenBMint;

                let eligibilityProofs: Array<{ type: string; proof: number[]; publicInputs: number[] }> = [];
                if (requiresEligibilityProofs && generateAllProofs) {
                    const proofBundle = await generateAllProofs(amountIn, mintIn);
                    if (!proofBundle?.primary) {
                        throw new Error('Eligibility proof generation failed');
                    }
                    eligibilityProofs = Array.from(proofBundle.proofs.entries()).map(([type, proof]) => ({
                        type,
                        proof: Array.from(proof.proof),
                        publicInputs: Array.from(proof.publicInputs),
                    }));
                }

                // 3. Get Token Accounts
                const userTokenA = await getAssociatedTokenAddress(poolConfig.tokenAMint, publicKey);
                const userTokenB = await getAssociatedTokenAddress(poolConfig.tokenBMint, publicKey);

                const inputShieldedPool = isAtoB ? poolConfig.shieldedPoolA : poolConfig.shieldedPoolB;
                const inputShieldedVault = isAtoB ? poolConfig.shieldedVaultA : poolConfig.shieldedVaultB;
                const inputRootHistory = isAtoB ? poolConfig.shieldedRootHistoryA : poolConfig.shieldedRootHistoryB;
                const reserveIn = isAtoB ? poolConfig.tokenAReserve : poolConfig.tokenBReserve;
                const reserveOut = isAtoB ? poolConfig.tokenBReserve : poolConfig.tokenAReserve;
                // mintIn already set above

                // 4. Create shielded note + commitment
                const mintField = addressToField(mintIn.toBase58());
                const poolField = addressToField(inputShieldedPool.toBase58());
                const noteRes = await fetch('/api/shielded/note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: amountInLamports.toString(),
                        mintField,
                        poolField,
                    }),
                });
                const noteData = await noteRes.json();
                if (!noteData.success) {
                    throw new Error(noteData.error || 'Failed to create shielded note');
                }
                const note = noteData.note;
                const commitmentBytes = fieldToLeBytes32(note.commitment);

                // 5. Deposit Funds (User Transaction)
                console.log("Depositing funds to Shielded Pool...");

                const depositIx = await program.methods
                    .deposit(amountInLamports, commitmentBytes)
                    .accounts({
                        shieldedPool: inputShieldedPool,
                        vault: inputShieldedVault,
                        userToken: isAtoB ? userTokenA : userTokenB,
                        user: publicKey,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction();

                // Construct and send Deposit Transaction
                const { Transaction } = await import('@solana/web3.js');
                const depositTx = new Transaction().add(depositIx);
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                depositTx.recentBlockhash = blockhash;
                depositTx.feePayer = publicKey;

                // We use signTransaction to sign and then sendRaw to ensure we wait for confirmation
                // Or easier: use useWallet's sendTransaction if available? 
                // But signTransaction is available from useWallet()
                const signedDeposit = await signTransaction(depositTx);
                const depositSig = await connection.sendRawTransaction(signedDeposit.serialize());

                console.log("Deposit Sent:", depositSig);
                await connection.confirmTransaction({
                    signature: depositSig,
                    blockhash,
                    lastValidBlockHeight
                }, 'confirmed');
                console.log("Deposit Confirmed!");

                // 6. Insert commitment into local sequencer tree (dev convenience)
                const commitRes = await fetch('/api/shielded/tree', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commitment: note.commitment, pool_id: inputShieldedPool.toBase58() }),
                });
                const commitData = await commitRes.json();
                if (!commitData.success) {
                    throw new Error(commitData.error || 'Failed to insert commitment');
                }
                note.index = commitData.index;
                saveNote(note);

                // 7. Fetch Merkle path
                const pathRes = await fetch(`/api/shielded/tree?index=${note.index}&pool_id=${inputShieldedPool.toBase58()}`);
                const pathData = await pathRes.json();
                if (!pathData.success) {
                    throw new Error(pathData.error || 'Failed to fetch merkle path');
                }

                // 8. Generate shielded spend proof
                const proofRes = await fetch('/api/prove/shielded', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: amountInLamports.toString(),
                        secret: note.secret,
                        nullifier: note.nullifier,
                        merkle_path: pathData.path,
                        merkle_indices: pathData.indices,
                        root: pathData.root,
                        recipient: (isAtoB ? userTokenB : userTokenA).toBase58(),
                        mint: mintIn.toBase58(),
                        pool_id: inputShieldedPool.toBase58(),
                    }),
                });
                const proofData = await proofRes.json();
                if (!proofData.success) {
                    throw new Error(proofData.error || proofData.details || 'Shielded proof generation failed');
                }

                const publicInputsBytes = new Uint8Array(proofData.publicInputs);
                const headerOffset = publicInputsBytes.length % 32 === 12 ? 12 : 0;
                const nullifierHashBytes = Array.from(
                    publicInputsBytes.slice(headerOffset + 32, headerOffset + 64)
                );
                const [nullifierPda] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from('nullifier'),
                        inputShieldedPool.toBuffer(),
                        Buffer.from(nullifierHashBytes),
                    ],
                    poolConfig.programId
                );

                // Start of Relayer Flow (Shadow v2)
                console.log("Constructing private transaction for Relayer...");

                const ix = await program.methods
                    .swapPrivate(
                        Buffer.from(proofData.proof),
                        Buffer.from(publicInputsBytes),
                        amountInLamports,
                        minOutLamports,
                        isAtoB, // Direction flag
                        nullifierHashBytes
                    )
                    .accounts({
                        pool: poolConfig.poolPda,
                        inputShieldedPool: inputShieldedPool,
                        inputRootHistory: inputRootHistory,
                        verifierProgram: poolConfig.shieldedVerifierProgramId,
                        nullifierAccount: nullifierPda,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        relayer: publicKey,
                    })
                    .remainingAccounts([
                        { pubkey: inputShieldedVault, isSigner: false, isWritable: true },
                        { pubkey: reserveIn, isSigner: false, isWritable: true },
                        { pubkey: reserveOut, isSigner: false, isWritable: true },
                        { pubkey: isAtoB ? userTokenB : userTokenA, isSigner: false, isWritable: true },
                    ])
                    .instruction();

                // Call Relayer Service
                const { RelayerService } = await import('@/api/relayer');
                const result = await RelayerService.submitTransaction({
                    proof: proofData.proof,
                    publicInputs: publicInputsBytes,
                    instructionData: ix.data as Buffer,
                    eligibilityProofs: eligibilityProofs.length > 0 ? eligibilityProofs : undefined,
                    requireEligibility: requiresEligibilityProofs,
                    accounts: {
                        pool: poolConfig.poolPda.toBase58(),
                        inputShieldedPool: inputShieldedPool.toBase58(),
                        inputRootHistory: inputRootHistory.toBase58(),
                        shieldedVaultIn: inputShieldedVault.toBase58(),
                        reserveIn: reserveIn.toBase58(),
                        reserveOut: reserveOut.toBase58(),
                        recipientToken: (isAtoB ? userTokenB : userTokenA).toBase58(),
                        verifierProgram: poolConfig.shieldedVerifierProgramId.toBase58(),
                        nullifierAccount: nullifierPda.toBase58(),
                        tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
                        systemProgram: SystemProgram.programId.toBase58(),
                    }
                });

                if (!result.success || !result.signature) {
                    if (result.logs && result.logs.length > 0) {
                        console.error('Relayer logs:', result.logs);
                    }
                    if (result.debug) {
                        console.error('Relayer debug:', result.debug);
                    }
                    const detail = result.error || (result.details ? JSON.stringify(result.details) : null);
                    throw new Error(detail || 'Relayer failed to execute swap');
                }

                const signature = result.signature;
                console.log("Relayer Success! Signature:", signature);

                // Handle Success (Mock or Real)
                // If it was a real relayer, we would wait for confirmation here using the signature.
                if (!signature.startsWith('5xMock')) {
                    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                    await connection.confirmTransaction({
                        signature,
                        blockhash,
                        lastValidBlockHeight
                    }, 'confirmed');
                }

                onSuccess(signature);
                onSwapComplete?.(signature);
            } catch (err: any) {
                let message = err instanceof Error ? err.message : 'Swap failed';
                console.error("Swap execution error:", err);
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
            requiresEligibilityProofs,
            onSwapComplete,
        ]
    );

    return {
        isSwapping,
        executeSwap,
    };
}
