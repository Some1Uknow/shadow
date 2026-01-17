import { PublicKey } from '@solana/web3.js';
import rawIdl from '@/idl/zkgate.json';

// Re-export the raw IDL for Program instantiation
export const IDL = rawIdl;

// IDL Type Definitions

export type ZkgateIDL = {
    address: string;
    metadata: {
        name: "zkgate";
        version: "0.1.0";
        spec: "0.1.0";
        description: "ZK-gated DEX on Solana with Noir proof verification";
    };
    instructions: [
        {
            name: "addLiquidity";
            discriminator: number[];
            accounts: [
                { name: "pool"; writable: true; },
                { name: "userTokenA"; writable: true; },
                { name: "userTokenB"; writable: true; },
                { name: "tokenAReserve"; writable: true; },
                { name: "tokenBReserve"; writable: true; },
                { name: "user"; signer: true; },
                { name: "tokenProgram"; writable: false; }
            ];
            args: [
                { name: "amountA"; type: "u64" },
                { name: "amountB"; type: "u64" }
            ];
        },
        {
            name: "createPool";
            discriminator: number[];
            accounts: [
                { name: "pool"; writable: true; pda: { seeds: any[] } },
                { name: "tokenAMint"; },
                { name: "tokenBMint"; },
                { name: "user"; writable: true; signer: true; },
                { name: "systemProgram"; writable: false; }
            ];
            args: [
                { name: "initA"; type: "u64" },
                { name: "initB"; type: "u64" }
            ];
        },
        {
            name: "getPoolInfo";
            discriminator: number[];
            accounts: [
                { name: "pool"; }
            ];
            args: [];
            returns: { defined: { name: "PoolInfo" } };
        },
        {
            name: "zkSwap";
            discriminator: number[];
            accounts: [
                { name: "pool"; writable: true; },
                { name: "userTokenA"; writable: true; },
                { name: "userTokenB"; writable: true; },
                { name: "tokenAReserve"; writable: true; },
                { name: "tokenBReserve"; writable: true; },
                { name: "user"; writable: true; signer: true; },
                { name: "verifierProgram"; },
                { name: "verifierState"; },
                { name: "tokenProgram"; writable: false; }
            ];
            args: [
                { name: "amountIn"; type: "u64" },
                { name: "minOut"; type: "u64" },
                { name: "proof"; type: "bytes" },
                { name: "publicInputs"; type: "bytes" }
            ];
        },
        {
            name: "zkSwapReverse";
            discriminator: number[];
            accounts: [
                { name: "pool"; writable: true; },
                { name: "userTokenA"; writable: true; },
                { name: "userTokenB"; writable: true; },
                { name: "tokenAReserve"; writable: true; },
                { name: "tokenBReserve"; writable: true; },
                { name: "user"; writable: true; signer: true; },
                { name: "verifierProgram"; },
                { name: "verifierState"; },
                { name: "tokenProgram"; writable: false; }
            ];
            args: [
                { name: "amountIn"; type: "u64" },
                { name: "minOut"; type: "u64" },
                { name: "proof"; type: "bytes" },
                { name: "publicInputs"; type: "bytes" }
            ];
        }
    ];
    accounts: [
        {
            name: "Pool";
            discriminator: number[];
            type: {
                kind: "struct";
                fields: [
                    { name: "tokenAMint"; type: "pubkey" },
                    { name: "tokenBMint"; type: "pubkey" },
                    { name: "tokenAReserve"; type: "u64" },
                    { name: "tokenBReserve"; type: "u64" },
                    { name: "k"; type: "u128" },
                    { name: "bump"; type: "u8" },
                    { name: "authority"; type: "pubkey" },
                    { name: "totalFeesA"; type: "u64" },
                    { name: "totalFeesB"; type: "u64" }
                ];
            };
        },
        {
            name: "PoolInfo";
            discriminator: number[];
            type: {
                kind: "struct";
                fields: [
                    { name: "tokenAMint"; type: "pubkey" },
                    { name: "tokenBMint"; type: "pubkey" },
                    { name: "tokenAReserve"; type: "u64" },
                    { name: "tokenBReserve"; type: "u64" },
                    { name: "k"; type: "u128" },
                    { name: "totalFeesA"; type: "u64" },
                    { name: "totalFeesB"; type: "u64" }
                ];
            };
        }
    ];
    errors: [
        { code: 6000; name: "SlippageExceeded"; msg: "Slippage tolerance exceeded" },
        { code: 6001; name: "InvalidProof"; msg: "Invalid ZK proof" },
        { code: 6002; name: "MathOverflow"; msg: "Math overflow" },
        { code: 6003; name: "ZeroAmount"; msg: "Amount must be greater than zero" },
        { code: 6004; name: "InsufficientLiquidity"; msg: "Insufficient liquidity in pool" },
        { code: 6005; name: "InvalidVerifier"; msg: "Invalid verifier program - cannot use System Program" }
    ];
    types: [
        {
            name: "Pool";
            type: {
                kind: "struct";
                fields: [
                    { name: "tokenAMint"; type: "pubkey" },
                    { name: "tokenBMint"; type: "pubkey" },
                    { name: "tokenAReserve"; type: "u64" },
                    { name: "tokenBReserve"; type: "u64" },
                    { name: "k"; type: "u128" },
                    { name: "bump"; type: "u8" },
                    { name: "authority"; type: "pubkey" },
                    { name: "totalFeesA"; type: "u64" },
                    { name: "totalFeesB"; type: "u64" }
                ];
            };
        },
        {
            name: "PoolInfo";
            type: {
                kind: "struct";
                fields: [
                    { name: "tokenAMint"; type: "pubkey" },
                    { name: "tokenBMint"; type: "pubkey" },
                    { name: "tokenAReserve"; type: "u64" },
                    { name: "tokenBReserve"; type: "u64" },
                    { name: "k"; type: "u128" },
                    { name: "totalFeesA"; type: "u64" },
                    { name: "totalFeesB"; type: "u64" }
                ];
            };
        }
    ];
};

// Program Types

export enum ProgramErrors {
    SlippageExceeded = 6000,
    InvalidProof = 6001,
    MathOverflow = 6002,
    ZeroAmount = 6003,
    InsufficientLiquidity = 6004,
    InvalidVerifier = 6005,
}

export const ERROR_MESSAGES: Record<ProgramErrors, string> = {
    [ProgramErrors.SlippageExceeded]: "Slippage tolerance exceeded",
    [ProgramErrors.InvalidProof]: "Invalid ZK proof",
    [ProgramErrors.MathOverflow]: "Math overflow",
    [ProgramErrors.ZeroAmount]: "Amount must be greater than zero",
    [ProgramErrors.InsufficientLiquidity]: "Insufficient liquidity in pool",
    [ProgramErrors.InvalidVerifier]: "Invalid verifier program",
};
