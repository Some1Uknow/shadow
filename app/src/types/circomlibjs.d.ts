declare module 'circomlibjs' {
  export type Poseidon = ((inputs: Array<bigint | number>) => bigint) & {
    F: { toString: (value: bigint) => string };
  };

  export function buildPoseidon(): Promise<Poseidon>;
}
