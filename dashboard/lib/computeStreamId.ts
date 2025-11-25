import { keccak256, toBytes } from 'viem'

export function computeStreamId(chain: string, pairAddress: string): `0x${string}` {
  const key = `${chain.toLowerCase().trim()}:${pairAddress.toLowerCase().trim()}`
  return keccak256(toBytes(key))
}