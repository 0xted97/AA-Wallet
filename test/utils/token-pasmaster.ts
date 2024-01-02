import {
  AbiCoder,
  concat,
  zeroPadValue,
  hexlify,
  BigNumberish,
} from 'ethers';

import { TokenPaymaster } from '../../typechain-types';
import { UserOperation } from './types';


const MOCK_VALID_UNTIL = '0x00000000deadbeef';
const MOCK_VALID_AFTER = '0x0000000000001234';

const defaultAbiCoder = new AbiCoder();

export function generatePaymasterAndDataOfTokenPM(tokenPaymaster: TokenPaymaster, tokenPrice?: BigNumberish): string {
  if (tokenPrice) {
    if (typeof tokenPrice !== 'string') {
      throw new Error('Invalid tokenPrice type');
    }

    return hexlify(
      concat([
        hexlify(tokenPaymaster.target.toString()), zeroPadValue(tokenPrice, 32),
        // defaultAbiCoder.encode(['uint48', 'uint48'], [MOCK_VALID_UNTIL, MOCK_VALID_AFTER]),
      ])
    )
  }
  return hexlify(
    concat([hexlify(tokenPaymaster.target.toString())])
  );
}
