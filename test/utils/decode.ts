import { AbiCoder, Interface, ethers } from "ethers";
import { EntryPoint__factory, TokenPaymaster__factory } from "../../typechain-types";

const defaultAbiCoder = new AbiCoder();

const decodeRevertReasonContracts = new Interface([
    ...[
      ...EntryPoint__factory.createInterface().fragments,
      ...TokenPaymaster__factory.createInterface().fragments
    ].filter(f => f.type === 'error')
  ]) //

  
export function decodeRevertReason (data: string | Error, nullIfNoMatch = true): string | null {
    if (typeof data !== 'string') {
      const err = data as any
      data = (err.data ?? err.error.data) as string
    }
    const methodSig = data.slice(0, 10)
    const dataParams = '0x' + data.slice(10)
  
    if (methodSig === '0x08c379a0') {
      const [err] = defaultAbiCoder.decode(['string'], dataParams)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      return `Error(${err})`
    } else if (methodSig === '0x4e487b71') {
      const [code] = defaultAbiCoder.decode(['uint256'], dataParams)
      return `Panic(${code ?? code} + ')`
    }
  
    try {
      const err = decodeRevertReasonContracts.parseError(data)
      // let args: any[] = err.args as any
  
      // treat any error "bytes" argument as possible error to decode (e.g. FailedOpWithRevert, PostOpReverted)
      const args = err.args.map((arg: any, index) => {
        switch (err.errorFragment.inputs[index].type) {
          case 'bytes' : return decodeRevertReason(arg)
          case 'string': return `"${(arg as string)}"`
          default: return arg
        }
      })
      return `${err.name}(${args.join(',')})`
    } catch (e) {
      // throw new Error('unsupported errorSig ' + data)
      if (!nullIfNoMatch) {
        return data
      }
      return null
    }
  }