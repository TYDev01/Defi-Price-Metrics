import { keccak256, toHex } from 'viem';
import { SchemaEncoder } from '@somnia-chain/streams';

/**
 * Schema definition for price data
 * Matches Somnia Data Streams schema:
 * uint64 timestamp,
 * string pair,
 * string chain,
 * uint256 priceUsd,
 * uint256 liquidity,
 * uint256 volume24h,
 * int32 priceChange1h,
 * int32 priceChange24h
 */
export const PRICE_SCHEMA = 'uint64 timestamp, string pair, string chain, uint256 priceUsd, uint256 liquidity, uint256 volume24h, int32 priceChange1h, int32 priceChange24h';

// Initialize schema encoder
const schemaEncoder = new SchemaEncoder(PRICE_SCHEMA);
export interface PriceData {
  timestamp: bigint;
  pair: string;
  chain: string;
  priceUsd: bigint;
  liquidity: bigint;
  volume24h: bigint;
  priceChange1h: number;
  priceChange24h: number;
}

/**
 * Convert DexScreener data to internal PriceData format
 */
export interface DexScreenerUpdate {
  schemaVersion: string;
  pairs: Array<{
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
    quoteToken: {
      address: string;
      name: string;
      symbol: string;
    };
    priceNative: string;
    priceUsd?: string;
    txns: {
      m5: { buys: number; sells: number };
      h1: { buys: number; sells: number };
      h6: { buys: number; sells: number };
      h24: { buys: number; sells: number };
    };
    volume: {
      h24: number;
      h6: number;
      h1: number;
      m5: number;
    };
    priceChange: {
      m5: number;
      h1: number;
      h6: number;
      h24: number;
    };
    liquidity?: {
      usd?: number;
      base: number;
      quote: number;
    };
    fdv?: number;
    marketCap?: number;
    pairCreatedAt?: number;
  }>;
}

/**
 * Convert floating point price to uint256 (with 18 decimals)
 */
export function priceToUint256(price: number): bigint {
  const decimals = 18;
  const scaled = Math.floor(price * 10 ** decimals);
  return BigInt(scaled);
}

/**
 * Convert percentage to int32 (basis points: 100 = 1%)
 */
export function percentageToInt32(percentage: number): number {
  return Math.floor(percentage * 100);
}

/**
 * Parse DexScreener SSE update and convert to PriceData
 */
export function parseDexScreenerUpdate(data: DexScreenerUpdate): PriceData | null {
  if (!data.pairs || data.pairs.length === 0) {
    return null;
  }

  const pair = data.pairs[0];
  
  if (!pair.priceUsd) {
    return null;
  }

  const priceUsd = parseFloat(pair.priceUsd);
  const liquidity = pair.liquidity?.usd || 0;
  const volume24h = pair.volume?.h24 || 0;
  const priceChange1h = pair.priceChange?.h1 || 0;
  const priceChange24h = pair.priceChange?.h24 || 0;

  return {
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    pair: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
    chain: pair.chainId,
    priceUsd: priceToUint256(priceUsd),
    liquidity: priceToUint256(liquidity),
    volume24h: priceToUint256(volume24h),
    priceChange1h: percentageToInt32(priceChange1h),
    priceChange24h: percentageToInt32(priceChange24h),
  };
}

/**
 * Encode PriceData for Somnia Data Streams using SDK SchemaEncoder
 */
export function encodePriceData(data: PriceData): `0x${string}` {
  return schemaEncoder.encodeData([
    { name: 'timestamp', value: data.timestamp.toString(), type: 'uint64' },
    { name: 'pair', value: data.pair, type: 'string' },
    { name: 'chain', value: data.chain, type: 'string' },
    { name: 'priceUsd', value: data.priceUsd.toString(), type: 'uint256' },
    { name: 'liquidity', value: data.liquidity.toString(), type: 'uint256' },
    { name: 'volume24h', value: data.volume24h.toString(), type: 'uint256' },
    { name: 'priceChange1h', value: data.priceChange1h.toString(), type: 'int32' },
    { name: 'priceChange24h', value: data.priceChange24h.toString(), type: 'int32' },
  ]);
}

/**
 * Generate unique key for a trading pair as bytes32
 * Uses keccak256 hash to convert chain:address to proper bytes32 format
 */
export function generatePairKey(chain: string, pairAddress: string): `0x${string}` {
  const keyString = `${chain}:${pairAddress}`;
  // keccak256 already returns 0x-prefixed hex, toHex converts string to bytes
  return keccak256(toHex(keyString));
}
