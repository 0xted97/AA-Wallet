import {
  AbiCoder,
  BytesLike,
  keccak256,
  Signer,
  Wallet,
  ZeroAddress
} from 'ethers';

import { UserOperation, UserOperationTypes } from "./types";
import { ethers, config } from 'hardhat';
import { EntryPoint, SimpleAccountFactory } from '../../typechain-types';

export const DefaultsForUserOp: UserOperation = {
  sender: ZeroAddress,
  nonce: 0,
  initCode: '0x',
  callData: '0x',
  callGasLimit: 0,
  verificationGasLimit: 150000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
  preVerificationGas: 21000, // should also cover calldata cost.
  maxFeePerGas: 0,
  maxPriorityFeePerGas: 1e9,
  paymasterAndData: '0x',
  signature: '0x'
}


const defaultAbiCoder = new AbiCoder();

export function getAccountInitCode(owner: string, factory: SimpleAccountFactory, salt = 0): string {
  const initCallData = factory.interface.encodeFunctionData("createAccount", [owner, salt]);
  const initCode = ethers.solidityPacked(
    ["bytes", "bytes"],
    [ethers.solidityPacked(["bytes"], [factory.target]), initCallData]
  );
  return initCode;
}

export function packUserOp(op: UserOperation, forSignature = true): string {
  if (forSignature) {
    return defaultAbiCoder.encode(UserOperationTypes,
      [op.sender, op.nonce, keccak256(op.initCode), keccak256(op.callData),
      op.callGasLimit, op.verificationGasLimit, op.preVerificationGas, op.maxFeePerGas, op.maxPriorityFeePerGas,
      keccak256(op.paymasterAndData)])
  } else {
    // for the purpose of calculating gas cost encode also signature (and no keccak of bytes)
    return defaultAbiCoder.encode(
      ['address', 'uint256', 'bytes', 'bytes',
        'uint256', 'uint256', 'uint256', 'uint256', 'uint256',
        'bytes', 'bytes'],
      [op.sender, op.nonce, op.initCode, op.callData,
      op.callGasLimit, op.verificationGasLimit, op.preVerificationGas, op.maxFeePerGas, op.maxPriorityFeePerGas,
      op.paymasterAndData, op.signature])
  }
}

export function packUserOp1(op: UserOperation): string {
  return defaultAbiCoder.encode(UserOperationTypes, [
    op.sender,
    op.nonce,
    keccak256(op.initCode),
    keccak256(op.callData),
    op.callGasLimit,
    op.verificationGasLimit,
    op.preVerificationGas,
    op.maxFeePerGas,
    op.maxPriorityFeePerGas,
    keccak256(op.paymasterAndData)
  ]);
}

export function getUserOpHash(op: UserOperation, entryPoint: string, chainId: number): string {
  const userOpHash = keccak256(packUserOp(op, true));
  const enc = defaultAbiCoder.encode(
    ['bytes32', 'address', 'uint256'],
    [userOpHash, entryPoint, chainId]);
  return keccak256(enc);
}

export async function fillAndSign(op: Partial<UserOperation>, signer: Wallet | Signer, entryPoint: EntryPoint) {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network?.chainId || config.networks.hardhat.chainId);

  const opFull = await fillUserOp(op);

  const opHash = getUserOpHash(opFull, await entryPoint.getAddress(), chainId);
  const signature = await signer.signMessage(ethers.getBytes(opHash));
  opFull.signature = signature;
  return opFull;
}

export async function fillUserOp(op: Partial<UserOperation>): Promise<UserOperation> {
  const opFull = {
    ...op,
    callGasLimit: 500_000,
    verificationGasLimit: 500_000,
    preVerificationGas: 500_000,
    // maxFeePerGas: 0,
    maxFeePerGas: op.paymasterAndData === '0x' ? 0 : 112,
    // maxPriorityFeePerGas: 0,
    maxPriorityFeePerGas: 82,
    paymasterAndData: op.paymasterAndData || '0x',
    signature: "0x"
  } as UserOperation;
  return opFull;
}