import { encodeAbiParameters, parseAbiParameters } from 'viem';

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
 * Encode PriceData for Somnia Data Streams
 */
export function encodePriceData(data: PriceData): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters('uint64, string, string, uint256, uint256, uint256, int32, int32'),
    [
      data.timestamp,
      data.pair,
      data.chain,
      data.priceUsd,
      data.liquidity,
      data.volume24h,
      data.priceChange1h,
      data.priceChange24h,
    ]
  );
}

/**
 * Generate unique key for a trading pair
 */
export function generatePairKey(chain: string, pairAddress: string): string {
  return `${chain}:${pairAddress}`;
}
