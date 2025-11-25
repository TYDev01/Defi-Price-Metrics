import { SDK, SchemaEncoder } from '@somnia-chain/streams'
import { createPublicClient, http, Hex, defineChain } from 'viem'
import { computeStreamId } from './streamId'

const SOMNIA_RPC_URL = process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network'
const SCHEMA_ID = process.env.NEXT_PUBLIC_SCHEMA_ID as `0x${string}`
const PUBLISHER_ADDRESS = process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS as `0x${string}`

// Schema definition - must match bot/src/schema/encoder.ts
const PRICE_SCHEMA = 'uint64 timestamp, string pair, string chain, uint256 priceUsd, uint256 liquidity, uint256 volume24h, int32 priceChange1h, int32 priceChange24h'

// Initialize schema encoder
const schemaEncoder = new SchemaEncoder(PRICE_SCHEMA)

// Define Somnia chain
const somniaChain = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: [SOMNIA_RPC_URL] },
  },
})

// Initialize Somnia SDK
let sdk: SDK | null = null

function getSDK(): SDK {
  if (!sdk) {
    const publicClient = createPublicClient({
      chain: somniaChain,
      transport: http(SOMNIA_RPC_URL),
    })

    sdk = new SDK({
      public: publicClient,
    })
  }
  return sdk
}

export interface HistoricalPricePoint {
  timestamp: number
  pair: string
  chain: string
  priceUsd: number
  liquidity: number
  volume24h: number
  priceChange1h: number
  priceChange24h: number
}

export interface HistoryLoadOptions {
  startIndex?: number
  endIndex?: number
  batchSize?: number
}

/**
 * Generate pair key using shared utility for consistency
 */
export function generatePairKey(chain: string, pairAddress: string): `0x${string}` {
  return computeStreamId(chain, pairAddress)
}

/**
 * Unwrap schema value (handles nested value objects)
 */
function unwrapSchemaValue(value: any): any {
  if (value && typeof value === 'object' && 'value' in value) {
    return unwrapSchemaValue(value.value)
  }
  return value
}

/**
 * Decode raw hex data to HistoricalPricePoint
 */
function decodeHistoricalEntry(encodedData: Hex): HistoricalPricePoint | null {
  try {
    const decoded = schemaEncoder.decodeData(encodedData)
    
    if (!decoded || decoded.length !== 8) {
      console.warn('Invalid decoded data length:', decoded?.length)
      return null
    }

    // Map decoded array to our structure and unwrap values
    const [timestamp, pair, chain, priceUsd, liquidity, volume24h, priceChange1h, priceChange24h] = decoded

    return {
      timestamp: Number(unwrapSchemaValue(timestamp)),
      pair: String(unwrapSchemaValue(pair)),
      chain: String(unwrapSchemaValue(chain)),
      priceUsd: Number(unwrapSchemaValue(priceUsd)) / 1e18, // Convert from uint256 with 18 decimals
      liquidity: Number(unwrapSchemaValue(liquidity)) / 1e18,
      volume24h: Number(unwrapSchemaValue(volume24h)) / 1e18,
      priceChange1h: Number(unwrapSchemaValue(priceChange1h)) / 100, // Convert from basis points
      priceChange24h: Number(unwrapSchemaValue(priceChange24h)) / 100,
    }
  } catch (error) {
    console.error('Failed to decode hex entry:', error)
    return null
  }
}

/**
 * Convert already decoded schema item array to HistoricalPricePoint
 */
function convertDecodedEntry(decoded: any[]): HistoricalPricePoint | null {
  try {
    if (!decoded || decoded.length !== 8) {
      console.warn('Invalid decoded array length:', decoded?.length)
      return null
    }

    const [timestamp, pair, chain, priceUsd, liquidity, volume24h, priceChange1h, priceChange24h] = decoded

    return {
      timestamp: Number(unwrapSchemaValue(timestamp)),
      pair: String(unwrapSchemaValue(pair)),
      chain: String(unwrapSchemaValue(chain)),
      priceUsd: Number(unwrapSchemaValue(priceUsd)) / 1e18,
      liquidity: Number(unwrapSchemaValue(liquidity)) / 1e18,
      volume24h: Number(unwrapSchemaValue(volume24h)) / 1e18,
      priceChange1h: Number(unwrapSchemaValue(priceChange1h)) / 100,
      priceChange24h: Number(unwrapSchemaValue(priceChange24h)) / 100,
    }
  } catch (error) {
    console.error('Failed to convert decoded entry:', error)
    return null
  }
}

/**
 * Load historical price data for a specific pair
 * Uses batching and pagination for scalability
 */
export async function loadPriceHistory(
  pairKey: `0x${string}`,
  options: HistoryLoadOptions = {}
): Promise<HistoricalPricePoint[]> {
  const { startIndex, endIndex, batchSize = 500 } = options
  
  try {
    const somniaSDK = getSDK()
    
    // First get total count
    const total = await somniaSDK.streams.totalPublisherDataForSchema(
      SCHEMA_ID,
      PUBLISHER_ADDRESS
    )
    
    if (total instanceof Error) {
      throw total
    }
    
    if (total === BigInt(0)) {
      console.log('No historical data found')
      return []
    }
    
    console.log(`Total data points available: ${total}`)
    
    const allData: HistoricalPricePoint[] = []
    const start = startIndex !== undefined ? BigInt(startIndex) : BigInt(0)
    const end = endIndex !== undefined ? BigInt(endIndex) : total
    
    // Load data in batches
    let currentStart = start
    
    while (currentStart < end) {
      const currentEnd = currentStart + BigInt(batchSize) > end 
        ? end 
        : currentStart + BigInt(batchSize)
      
      console.log(`Fetching batch: ${currentStart} to ${currentEnd}`)
      
      const rawData = await somniaSDK.streams.getBetweenRange(
        SCHEMA_ID,
        PUBLISHER_ADDRESS,
        currentStart,
        currentEnd,
        false // decompress
      )
      
      if (rawData instanceof Error) {
        console.error('Error fetching range:', rawData)
        currentStart = currentEnd
        continue
      }
      
      if (Array.isArray(rawData) && rawData.length > 0) {
        // Check if it's Hex[] or SchemaDecodedItem[][]
        if (typeof rawData[0] === 'string') {
          // Hex[] - need to decode
          const decoded = (rawData as Hex[])
            .map(decodeHistoricalEntry)
            .filter((entry): entry is HistoricalPricePoint => entry !== null)
          allData.push(...decoded)
        } else {
          // SchemaDecodedItem[][] - already decoded
          const decoded = (rawData as any[][])
            .map(entry => convertDecodedEntry(entry))
            .filter((entry): entry is HistoricalPricePoint => entry !== null)
          allData.push(...decoded)
        }
      }
      
      currentStart = currentEnd
    }
    
    console.log(`Loaded ${allData.length} total historical entries`)
    
    // Sort by timestamp ascending
    return allData.sort((a: HistoricalPricePoint, b: HistoricalPricePoint) => a.timestamp - b.timestamp)
    
  } catch (error) {
    console.error('Failed to load price history:', error)
    throw error
  }
}

/**
 * Load recent price history (last N entries)
 * More efficient than loading everything
 */
export async function loadRecentHistory(
  pairKey: `0x${string}`,
  count: number = 1000
): Promise<HistoricalPricePoint[]> {
  try {
    const somniaSDK = getSDK()
    
    // Get total count
    const total = await somniaSDK.streams.totalPublisherDataForSchema(
      SCHEMA_ID,
      PUBLISHER_ADDRESS
    )
    
    if (total instanceof Error) {
      throw total
    }
    
    if (total === BigInt(0)) {
      return []
    }
    
    // Calculate start index for recent data
    const startIdx = total > BigInt(count) ? total - BigInt(count) : BigInt(0)
    
    console.log(`Loading recent ${count} entries (${startIdx} to ${total})`)
    
    // Use loadPriceHistory with range
    return loadPriceHistory(pairKey, {
      startIndex: Number(startIdx),
      endIndex: Number(total),
      batchSize: Math.min(count, 500),
    })
    
  } catch (error) {
    console.error('Failed to load recent history:', error)
    throw error
  }
}

/**
 * Cache for historical data to reduce RPC calls
 */
class HistoryCache {
  private cache = new Map<string, {
    data: HistoricalPricePoint[]
    timestamp: number
  }>()
  
  private ttl = 60000 // 60 seconds default TTL
  
  get(key: string): HistoricalPricePoint[] | null {
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }
  
  set(key: string, data: HistoricalPricePoint[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  setTTL(ttl: number): void {
    this.ttl = ttl
  }
}

export const historyCache = new HistoryCache()
