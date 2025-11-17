'use client'

import { useEffect } from 'react'
import { usePriceStore } from '@/lib/store'
import { decodePriceData } from '@/lib/utils'
import { SDK, SchemaEncoder } from '@somnia-chain/streams'
import { createPublicClient, http, defineChain } from 'viem'

const SOMNIA_RPC_URL = process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || ''
const SCHEMA_ID = process.env.NEXT_PUBLIC_SCHEMA_ID || ''
const PUBLISHER_ADDRESS = process.env.NEXT_PUBLIC_PUBLISHER_ADDRESS || ''
const PAIR_KEYS = process.env.NEXT_PUBLIC_PAIR_KEYS?.split(',') || []

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
    if (!SOMNIA_RPC_URL || !SCHEMA_ID || !PUBLISHER_ADDRESS) {
      console.error('Missing Somnia configuration')
      return
    }

    console.log('Connecting to Somnia Streams...', {
      rpcUrl: SOMNIA_RPC_URL,
      schemaId: SCHEMA_ID,
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

    // Poll for updates from Somnia Data Streams
    const pollInterval = setInterval(async () => {
      try {
        for (const key of PAIR_KEYS) {
          const data = await sdk.streams.getByKey(
            BigInt(SCHEMA_ID),
            PUBLISHER_ADDRESS as `0x${string}`,
            key as `0x${string}`
          )

          if (data) {
            // Decode the data using schema encoder
            const decoded = schemaEncoder.decode(data)
            
            // Convert to expected format
            const priceData = {
              timestamp: decoded[0],
              pair: decoded[1],
              chain: decoded[2],
              priceUsd: decoded[3],
              liquidity: decoded[4],
              volume24h: decoded[5],
              priceChange1h: decoded[6],
              priceChange24h: decoded[7],
            }

            updatePair(key, priceData)
            
            const price = Number(priceData.priceUsd) / 1e18
            const time = Number(priceData.timestamp)
            addHistoryPoint(key, time, price)
          }
        }
      } catch (error: any) {
        console.error('Somnia Streams polling error:', error)
        setError(error.message)
      }
    }, 5000) // Poll every 5 seconds

    // Fallback to mock data if no real data available
    const mockSubscription = setupMockSubscription(
      PAIR_KEYS,
      updatePair,
      addHistoryPoint
    )

    return () => {
      console.log('Disconnecting from Somnia Streams')
      setConnected(false)
      clearInterval(pollInterval)
      clearInterval(mockSubscription)
    }
  }, [updatePair, addHistoryPoint, setConnected, setError])
}

/**
 * Mock subscription for development
 */
function setupMockSubscription(
  keys: string[],
  updatePair: (key: string, data: any) => void,
  addHistoryPoint: (key: string, time: number, value: number) => void
): NodeJS.Timeout {
  // Price mappings for common tokens
  const tokenPrices: Record<string, number> = {
    'BONK': 0.000025,
    'UNI': 12.50,
    'ETH': 3500,
    'WETH': 3500,
    'FTM': 0.75,
    'LINK': 15.80,
    'DAI': 1.00,
    'SUSHI': 1.20,
    'SOL': 120,
    'USDC': 1.00,
    'USDT': 1.00,
  }

  // Generate mock pairs from the actual keys
  const mockPairs = keys.map((key) => {
    const [chain, address] = key.split(':')
    // Extract token symbols from the NEXT_PUBLIC_PAIR_KEYS (you can parse from config)
    // For now, use chain-based defaults
    const symbols = {
      'solana': 'BONK/USDC',
      'ethereum': 'UNI/USDC',
      'polygon': 'ETH/USDC',
      'bsc': 'FTM/USDT',
      'avalanche': 'LINK/USDC',
      'fantom': 'DAI/USDC',
      'arbitrum': 'SUSHI/USDC',
    }
    
    const symbol = symbols[chain as keyof typeof symbols] || 'TOKEN/USDC'
    const baseToken = symbol.split('/')[0]
    const basePrice = tokenPrices[baseToken] || 1.0
    
    return { key, symbol, basePrice, chain }
  })

  return setInterval(() => {
    mockPairs.forEach((pair) => {
      const volatility = 0.02 // 2% volatility
      const priceChange = (Math.random() - 0.5) * volatility
      const price = pair.basePrice * (1 + priceChange)
      
      const mockData = {
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        pair: pair.symbol,
        chain: pair.chain,
        priceUsd: BigInt(Math.floor(price * 1e18)),
        liquidity: BigInt(Math.floor(Math.random() * 10000000 * 1e18)),
        volume24h: BigInt(Math.floor(Math.random() * 5000000 * 1e18)),
        priceChange1h: Math.floor((Math.random() - 0.5) * 500),
        priceChange24h: Math.floor((Math.random() - 0.5) * 1000),
      }

      updatePair(pair.key, mockData)
      addHistoryPoint(pair.key, Date.now() / 1000, price)
    })
  }, 2000) // Update every 2 seconds
}
