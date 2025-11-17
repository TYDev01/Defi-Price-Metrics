'use client'

import { useEffect } from 'react'
import { usePriceStore, type PriceData } from '@/lib/store'
import { SDK, SchemaEncoder } from '@somnia-chain/streams'
import { createPublicClient, http, defineChain, keccak256, toHex } from 'viem'

const SOMNIA_RPC_URL = process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || ''
const SCHEMA_ID = process.env.NEXT_PUBLIC_SCHEMA_ID || ''
const PUBLISHER_ADDRESS = process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS || ''
const PAIR_KEYS = process.env.NEXT_PUBLIC_PAIR_KEYS?.split(',').map((key) => key.trim()).filter(Boolean) || []
const NORMALIZED_SCHEMA_ID = normalizeSchemaId(SCHEMA_ID)

const somniaChain = defineChain({
  id: 50311,
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
export function useSomniaStreams() {
  const { updatePair, addHistoryPoint, setConnected, setError } = usePriceStore()

  useEffect(() => {
    if (!SOMNIA_RPC_URL || !NORMALIZED_SCHEMA_ID || !PUBLISHER_ADDRESS) {
      console.error('Missing Somnia configuration')
      return
    }

    console.log('Connecting to Somnia Streams...', {
      rpcUrl: SOMNIA_RPC_URL,
      schemaId: NORMALIZED_SCHEMA_ID,
      publisher: PUBLISHER_ADDRESS,
      pairs: PAIR_KEYS,
    })

    // Initialize SDK with public client only (read-only for dashboard)
    const publicClient = createPublicClient({
      chain: somniaChain,
      transport: http(SOMNIA_RPC_URL),
    })

    const sdk = new SDK({
      public: publicClient,
    })

    const schemaEncoder = new SchemaEncoder(priceSchema)
    setConnected(true)

    // Seed UI with current DexScreener prices while waiting for Somnia data
    seedFallbackPrices(PAIR_KEYS, updatePair).catch((error) => {
      console.warn('DexScreener fallback failed:', error)
    })

    // Poll for updates from Somnia Data Streams
    const pollInterval = setInterval(async () => {
      try {
        for (const key of PAIR_KEYS) {
          const streamKey = generatePairKey(key)
          try {
            const data = await sdk.streams.getByKey(
              NORMALIZED_SCHEMA_ID,
              PUBLISHER_ADDRESS as `0x${string}`,
              streamKey
            )

            if (data instanceof Error) {
              console.warn(`Somnia returned error for ${key}:`, data.message)
              continue
            }

            const priceData = decodePriceUpdate(schemaEncoder, data)

            if (priceData) {
              console.log(`Received Somnia data for ${key}:`, priceData)

              updatePair(key, priceData)
              
              const price = Number(priceData.priceUsd) / 1e18
              const time = Number(priceData.timestamp)
              addHistoryPoint(key, time, price)
              console.log(`Updated ${key} with price: $${price.toFixed(2)}`)
            } else {
              console.log(`No decodable data from Somnia for ${key}`)
            }
          } catch (keyError: any) {
            console.warn(`Error fetching data for ${key}:`, keyError.message)
          }
        }
      } catch (error: any) {
        console.error('Somnia Streams polling error:', error)
        setError(error.message)
      }
    }, 3000) // Poll every 3 seconds

    return () => {
      console.log('Disconnecting from Somnia Streams')
      setConnected(false)
      clearInterval(pollInterval)
    }
  }, [updatePair, addHistoryPoint, setConnected, setError])
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
  return keccak256(toHex(pairKey))
}

async function seedFallbackPrices(pairKeys: string[], updatePair: (key: string, data: PriceData) => void) {
  if (!pairKeys.length) return

  for (const key of pairKeys) {
    try {
      const fallback = await fetchDexscreenerSnapshot(key)
      if (fallback) {
        updatePair(key, fallback)
      }
    } catch (error) {
      console.warn(`Failed to fetch DexScreener snapshot for ${key}:`, (error as Error).message)
    }
  }
}

async function fetchDexscreenerSnapshot(pairKey: string): Promise<PriceData | null> {
  const [chain, address] = pairKey.split(':')
  if (!chain || !address) {
    return null
  }

  const url = `https://api.dexscreener.com/latest/dex/pairs/${chain}/${address}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`DexScreener HTTP ${response.status}`)
  }

  const payload = await response.json()
  const pair = payload?.pairs?.[0]

  if (!pair || !pair.priceUsd) {
    return null
  }

  return {
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    pair: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
    chain: pair.chainId,
    priceUsd: toUint256(parseFloat(pair.priceUsd)),
    liquidity: toUint256(pair.liquidity?.usd ?? 0),
    volume24h: toUint256(pair.volume?.h24 ?? 0),
    priceChange1h: toBasisPoints(pair.priceChange?.h1 ?? 0),
    priceChange24h: toBasisPoints(pair.priceChange?.h24 ?? 0),
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

function toUint256(value: number): bigint {
  if (!Number.isFinite(value)) {
    return BigInt(0)
  }

  const scaled = Math.floor(value * 1e18)
  return BigInt(Math.max(scaled, 0))
}

function toBasisPoints(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 100)
}


