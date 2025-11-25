'use client'

import { useEffect, useMemo } from 'react'
import { usePriceStore, type PriceData } from '@/lib/store'
import { SchemaEncoder, SDK } from '@somnia-chain/streams'
import { createPublicClient, http, defineChain } from 'viem'
import { computeStreamId } from '../lib/streamId'

const SOMNIA_RPC_URL = process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || ''
const SCHEMA_ID = process.env.NEXT_PUBLIC_SCHEMA_ID || ''
const PUBLISHER_ADDRESS = process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS || ''
const NORMALIZED_SCHEMA_ID = normalizeSchemaId(SCHEMA_ID)

const somniaChain = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: [SOMNIA_RPC_URL] },
  },
})

// Schema matching the bot's encoder
const priceSchema = 'uint64 timestamp, string pair, string chain, uint256 priceUsd, uint256 liquidity, uint256 volume24h, int32 priceChange1h, int32 priceChange24h'

/**
 * Hook to subscribe to Somnia Data Streams
 */
export function useSomniaStreams(customPairKeys?: string[]) {
  const { updatePair, addHistoryPoint, setConnected, setError } = usePriceStore()

  const sanitizedPairs = useMemo(() => {
    // Only use pairs passed via props (from Firebase pair registry)
    if (!customPairKeys || customPairKeys.length === 0) {
      return []
    }
    return customPairKeys.map((key) => key.trim()).filter(Boolean)
  }, [customPairKeys?.join('|')])

  useEffect(() => {
    if (!SOMNIA_RPC_URL || !NORMALIZED_SCHEMA_ID || !PUBLISHER_ADDRESS) {
      console.error('Missing Somnia configuration')
      return
    }

    console.log('Connecting to Somnia Streams...', {
      rpcUrl: SOMNIA_RPC_URL,
      schemaId: NORMALIZED_SCHEMA_ID,
      publisher: PUBLISHER_ADDRESS,
      pairs: sanitizedPairs,
    })

    // Debug: Log the stream keys being generated
    console.log('Stream keys being polled:')
    sanitizedPairs.forEach(key => {
      const streamKey = generatePairKey(key)
      console.log(`  ${key} -> ${streamKey}`)
    })

    const schemaId = NORMALIZED_SCHEMA_ID as `0x${string}`
    const publisher = PUBLISHER_ADDRESS as `0x${string}`

    // Initialize read-only client for direct contract reads
    const publicClient = createPublicClient({
      chain: somniaChain,
      transport: http(SOMNIA_RPC_URL),
    })

    const sdk = new SDK({
      public: publicClient,
    })

    const schemaEncoder = new SchemaEncoder(priceSchema)
    setConnected(true)

    console.log('Polling Somnia Data Streams via SDK only - no external APIs')

    const pollOnce = async () => {
      try {
        console.log(`Polling ${sanitizedPairs.length} pairs from Somnia...`)
        
        const results = await Promise.allSettled(
          sanitizedPairs.map(async (key) => {
            const streamKey = generatePairKey(key)
            const priceData = await fetchLatestStreamUpdate({
              sdk,
              schemaId,
              publisher,
              streamKey,
              schemaEncoder,
            })
            return { key, priceData }
          })
        )

        let successCount = 0
        let noDataCount = 0
        let errorCount = 0
        
        results.forEach((result, index) => {
          const key = sanitizedPairs[index]
          
          if (result.status === 'fulfilled') {
            const { priceData } = result.value
            if (priceData) {
              successCount++
              console.log(`✅ ${key}: $${(Number(priceData.priceUsd) / 1e18).toFixed(2)}`)

              updatePair(key, priceData)
              
              const price = Number(priceData.priceUsd) / 1e18
              const time = Number(priceData.timestamp)
              addHistoryPoint(key, time, price)
            } else {
              noDataCount++
              console.log(`⚠️  ${key}: No data yet`)
            }
          } else {
            errorCount++
            console.warn(`❌ ${key}: ${result.reason?.message || result.reason}`)
          }
        })
        
        console.log(`Poll complete: ${successCount} success, ${noDataCount} no data, ${errorCount} errors`)
      } catch (error: any) {
        console.error('Somnia Streams polling error:', error)
        setError(error.message)
      }
    }

    // Poll for updates from Somnia Data Streams
    // Kick off immediately, then poll every 3 seconds
    pollOnce()
    const pollInterval = setInterval(pollOnce, 3000)

    return () => {
      console.log('Disconnecting from Somnia Streams')
      setConnected(false)
      clearInterval(pollInterval)
    }
  }, [sanitizedPairs, updatePair, addHistoryPoint, setConnected, setError])
}

function normalizeSchemaId(value: string): `0x${string}` | null {
  if (!value) return null

  if (value.startsWith('0x')) {
    return value as `0x${string}`
  }

  try {
    const hex = `0x${BigInt(value).toString(16).padStart(64, '0')}`
    return hex as `0x${string}`
  } catch (error) {
    console.error('Invalid schema ID provided:', value)
    return null
  }
}

function generatePairKey(pairKey: string): `0x${string}` {
  // Split the pairKey (format: "chain:address") and use shared utility
  const [chain, address] = pairKey.split(':')
  if (!chain || !address) {
    console.error('Invalid pairKey format:', pairKey)
    // Can't fallback without imports, throw error
    throw new Error(`Invalid pairKey format: ${pairKey}`)
  }
  
  // Use the shared computeStreamId function to ensure consistency
  return computeStreamId(chain, address)
}

async function fetchLatestStreamUpdate({
  sdk,
  schemaId,
  publisher,
  streamKey,
  schemaEncoder,
}: {
  sdk: SDK
  schemaId: `0x${string}`
  publisher: `0x${string}`
  streamKey: `0x${string}`
  schemaEncoder: SchemaEncoder
}): Promise<PriceData | null> {
  try {
    const raw = await sdk.streams.getByKey(schemaId, publisher, streamKey, false)

    if (!raw || raw instanceof Error || !Array.isArray(raw) || raw.length === 0) {
      console.warn(`No data found for stream ${streamKey}`)
      return null
    }

    const latest = raw[raw.length - 1] as any

    return decodePriceUpdate(schemaEncoder, latest)
  } catch (error) {
    console.error('Somnia Streams read failed for', streamKey, ':', (error as Error).message)
    return null
  }
}

function decodePriceUpdate(schemaEncoder: SchemaEncoder, payload: unknown): PriceData | null {
  const schemaItems = extractSchemaItems(schemaEncoder, payload)
  if (!schemaItems) {
    return null
  }

  const getValue = (name: string) => {
    const entry = schemaItems.find((item) => item.name === name)
    if (!entry) {
      return null
    }
    return unwrapSchemaValue(entry.value)
  }

  const priceData: PriceData = {
    timestamp: toBigInt(getValue('timestamp')),
    pair: String(getValue('pair') || ''),
    chain: String(getValue('chain') || ''),
    priceUsd: toBigInt(getValue('priceUsd')),
    liquidity: toBigInt(getValue('liquidity')),
    volume24h: toBigInt(getValue('volume24h')),
    priceChange1h: toNumber(getValue('priceChange1h')),
    priceChange24h: toNumber(getValue('priceChange24h')),
  }

  return priceData
}

function extractSchemaItems(schemaEncoder: SchemaEncoder, payload: unknown) {
  if (!payload) {
    return null
  }

  if (Array.isArray(payload)) {
    const first = payload[0]
    if (!first) {
      return null
    }

    if (typeof first === 'string') {
      return schemaEncoder.decodeData(first as `0x${string}`)
    }

    if (Array.isArray(first)) {
      return first as any[]
    }

    // Already decoded SchemaDecodedItem[]
    if (typeof first === 'object' && first !== null && 'name' in first) {
      return payload as any[]
    }

    return null
  }

  if (typeof payload === 'string') {
    return schemaEncoder.decodeData(payload as `0x${string}`)
  }

  return null
}

function unwrapSchemaValue(value: any): any {
  if (value && typeof value === 'object' && 'value' in value) {
    return unwrapSchemaValue(value.value)
  }
  return value
}

function toBigInt(value: any): bigint {
  if (typeof value === 'bigint') {
    return value
  }

  if (typeof value === 'number') {
    return BigInt(Math.trunc(value))
  }

  if (typeof value === 'string') {
    try {
      return BigInt(value)
    } catch {
      const numeric = Number(value)
      if (Number.isFinite(numeric)) {
        return BigInt(Math.trunc(numeric))
      }
    }
  }

  return BigInt(0)
}

function toNumber(value: any): number {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'bigint') {
    return Number(value)
  }

  if (typeof value === 'string') {
    return Number(value)
  }

  return 0
}
