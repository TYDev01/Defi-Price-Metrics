/**
 * Shared utility for computing stream IDs consistently across bot and dashboard
 * This ensures the writer and reader use EXACTLY the same hashing method
 */

import { keccak256, toHex } from 'viem'

/**
 * Compute stream ID from chain and pair address
 * Uses consistent lowercasing and hashing to ensure writer and reader match
 * 
 * @param chain - Chain identifier (e.g., "ethereum", "solana")
 * @param pairAddress - Pair contract address
 * @returns 32-byte stream ID as hex string
 */
export function computeStreamId(chain: string, pairAddress: string): `0x${string}` {
  // Normalize to lowercase to ensure consistency
  const normalizedChain = chain.toLowerCase().trim()
  const normalizedAddress = pairAddress.toLowerCase().trim()
  
  // Create the key string
  const keyString = `${normalizedChain}:${normalizedAddress}`
  
  // Hash using keccak256(toHex(string))
  // toHex converts the string to UTF-8 bytes, then keccak256 hashes it
  return keccak256(toHex(keyString))
}
