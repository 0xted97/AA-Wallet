import {
  AbiCoder,
  Signer,
  Wallet,
  concat,
  toBeArray,
} from 'ethers';

import { VerifyingPaymaster } from '../../typechain-types';
import { UserOperation } from './types';


const MOCK_VALID_UNTIL = '0x00000000deadbeef';
const MOCK_VALID_AFTER = '0x0000000000001234';

const defaultAbiCoder = new AbiCoder();

export function concatHash(verifyingPaymaster: VerifyingPaymaster, signature: string = '0x' + '00'.repeat(65)): string {
  return concat([verifyingPaymaster.target.toString(), defaultAbiCoder.encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]), signature])
}

export async function generatePaymasterAndDataOfVerifyingPM(op: UserOperation, verifyingPaymaster: VerifyingPaymaster, verifier: Wallet | Signer): Promise<string> {
  const opHash = await verifyingPaymaster.getHash(op, MOCK_VALID_UNTIL, MOCK_VALID_AFTER);
  const sig = await verifier.signMessage(toBeArray(opHash));
  const data = concat([
    verifyingPaymaster.target.toString(),
    defaultAbiCoder.encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]),
    sig
  ]);
  return data;
}