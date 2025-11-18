import { decodeAbiParameters, parseAbiParameters } from 'viem'
import { PriceData } from './store'

/**
 * Decode price data from Somnia Streams
 */
export function decodePriceData(data: `0x${string}`): PriceData {
  const decoded = decodeAbiParameters(
    parseAbiParameters('uint64, string, string, uint256, uint256, uint256, int32, int32'),
    data
  )

  return {
    timestamp: decoded[0],
    pair: decoded[1],
    chain: decoded[2],
    priceUsd: decoded[3],
    liquidity: decoded[4],
    volume24h: decoded[5],
    priceChange1h: decoded[6],
    priceChange24h: decoded[7],
  }
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(priceUsd: bigint): string {
  const price = Number(priceUsd) / 1e18
  
  if (price < 0.01) {
    return `$${price.toFixed(6)}`
  } else if (price < 1) {
    return `$${price.toFixed(4)}`
  } else if (price < 100) {
    return `$${price.toFixed(2)}`
  } else {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

/**
 * Format large numbers (volume, liquidity)
 */
export function formatLargeNumber(value: bigint): string {
  const num = Number(value) / 1e18
  
  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`
  } else if (num >= 1e3) {
    return `$${(num / 1e3).toFixed(2)}K`
  } else {
    return `$${num.toFixed(2)}`
  }
}

/**
 * Format percentage change
 */
export function formatPercentage(basisPoints: number): string {
  const percentage = basisPoints / 100
  const sign = percentage >= 0 ? '+' : ''
  return `${sign}${percentage.toFixed(2)}%`
}

/**
 * Get color class for price change
 */
export function getChangeColor(change: number): string {
  return change >= 0 ? 'text-up' : 'text-down'
}

/**
 * Get chain icon/name
 */
export function getChainInfo(chain: string): { name: string; icon: string } {
  const chains: Record<string, { name: string; icon: string }> = {
    solana: { name: 'Solana', icon: '◎' },
    ethereum: { name: 'Ethereum', icon: 'Ξ' },
    base: { name: 'Base', icon: '🔵' },
    arbitrum: { name: 'Arbitrum', icon: '🔷' },
    polygon: { name: 'Polygon', icon: '💜' },
    bsc: { name: 'BNB Chain', icon: '🟡' },
    avalanche: { name: 'Avalanche', icon: '🏔️' },
    optimism: { name: 'Optimism', icon: '🟥' },
    fantom: { name: 'Fantom', icon: '👻' },
    blast: { name: 'Blast', icon: '💥' },
    linea: { name: 'Linea', icon: '〽️' },
    scroll: { name: 'Scroll', icon: '📜' },
  }

  return chains[chain.toLowerCase()] || { name: chain, icon: '🔗' }
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`
}
