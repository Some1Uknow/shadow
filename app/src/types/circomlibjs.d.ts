declare module 'circomlibjs' {
  export function buildPoseidon(): Promise<(inputs: Array<bigint | number>) => bigint>;
}
