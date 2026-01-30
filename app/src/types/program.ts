import type { Idl } from '@coral-xyz/anchor';
import rawIdl from '@/idl/zkgate.json';

export const IDL = rawIdl as Idl;
export type ZkgateIDL = Idl;
