// define the same export types as used by export typechain/ethers
import { BigNumberish, BytesLike, AddressLike } from 'ethers';

export type address = AddressLike;
export type uint256 = BigNumberish;
export type uint = BigNumberish;
export type uint48 = BigNumberish;
export type bytes = BytesLike;
export type bytes32 = BytesLike;


export interface UserOperation {
    sender: address
    nonce: uint256
    initCode: bytes
    callData: bytes
    callGasLimit: uint256
    verificationGasLimit: uint256
    preVerificationGas: uint256
    maxFeePerGas: uint256
    maxPriorityFeePerGas: uint256
    paymasterAndData: bytes
    signature: bytes
}

export const UserOperationTypes = ['address', // sender
    'uint256', // nonce
    'bytes32', // initCode
    'bytes32', // callData
    'uint256', // callGasLimit
    'uint256', // verificationGasLimit
    'uint256', // preVerificationGas
    'uint256', // maxFeePerGas
    'uint256', // maxPriorityFeePerGas
    'bytes32' // paymasterAndData
]