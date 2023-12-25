import {
  AbiCoder,
  Signer,
  Wallet,
  concat,
  toBeArray,
  zeroPadValue,
  hexlify
} from 'ethers';

import { TokenPaymaster } from '../../typechain-types';
import { UserOperation } from './types';



const defaultAbiCoder = new AbiCoder();

export function generatePaymasterAndDataOfTokenPM(tokenPaymaster: TokenPaymaster, tokenPrice?: string): string {
  if (tokenPrice != null) {
    return hexlify(
      concat([tokenPaymaster.target.toString(), zeroPadValue(hexlify(tokenPrice), 32)])
    )
  } else {
    return hexlify(
      concat([tokenPaymaster.target.toString()])
    );
  }
}
