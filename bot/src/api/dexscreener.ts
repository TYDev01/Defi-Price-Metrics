import { logger } from '../utils/logger';
import { PairConfig } from '../config';
import { DexScreenerUpdate } from '../schema/encoder';

export interface DexScreenerAPIOptions {
  pollIntervalMs: number;
  onUpdate: (chain: string, pairAddress: string, data: DexScreenerUpdate) => void;
  onError: (chain: string, pairAddress: string, error: Error) => void;
}

interface DexScreenerPair {
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
}

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[] | null;
}

export class DexScreenerAPI {
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();
  private options: DexScreenerAPIOptions;
  private readonly baseUrl = 'https://api.dexscreener.com/latest/dex/pairs';

  constructor(options: DexScreenerAPIOptions) {
    this.options = options;
  }

  /**
   * Start monitoring a trading pair
   */
  public startPair(pair: PairConfig): void {
    const key = this.getPairKey(pair.chain, pair.pairAddress);
    
    if (this.pollIntervals.has(key)) {
      logger.warn(`Pair ${pair.symbol} (${key}) is already being monitored`);
      return;
    }

    logger.info(`Starting price polling for ${pair.symbol} (${key})`);
    
    // Fetch immediately
    this.fetchPairData(pair);
    
    // Then poll at interval
    const interval = setInterval(() => {
      this.fetchPairData(pair);
    }, this.options.pollIntervalMs);

    this.pollIntervals.set(key, interval);
  }

  /**
   * Stop monitoring a trading pair
   */
  public stopPair(chain: string, pairAddress: string): void {
    const key = this.getPairKey(chain, pairAddress);
    const interval = this.pollIntervals.get(key);
    
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(key);
      logger.info(`Stopped polling for ${key}`);
    }
  }

  /**
   * Stop all polling
   */
  public stopAll(): void {
    logger.info('Stopping all price polling');
    
    for (const interval of this.pollIntervals.values()) {
      clearInterval(interval);
    }
    
    this.pollIntervals.clear();
  }

  /**
   * Get polling status
   */
  public getStatus(): Array<{ key: string; polling: boolean }> {
    const status = [];
    
    for (const key of this.pollIntervals.keys()) {
      status.push({
        key,
        polling: true,
      });
    }
    
    return status;
  }

  /**
   * Fetch pair data from DexScreener REST API
   */
  private async fetchPairData(pair: PairConfig): Promise<void> {
    const key = this.getPairKey(pair.chain, pair.pairAddress);
    const url = `${this.baseUrl}/${pair.chain}/${pair.pairAddress}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as DexScreenerResponse;

      if (!data.pairs || data.pairs.length === 0) {
        logger.warn(`No pair data found for ${key}`);
        return;
      }

      // Convert to SSE-compatible format
      const updateData: DexScreenerUpdate = {
        schemaVersion: data.schemaVersion,
        pairs: data.pairs,
      };

      this.options.onUpdate(pair.chain, pair.pairAddress, updateData);
      
      const priceUsd = data.pairs[0].priceUsd;
      if (priceUsd) {
        logger.debug(`${pair.symbol}: $${parseFloat(priceUsd).toFixed(6)}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error fetching data for ${key}:`, err);
      this.options.onError(pair.chain, pair.pairAddress, err);
    }
  }

  /**
   * Generate unique key for a pair
   */
  private getPairKey(chain: string, pairAddress: string): string {
    return `${chain}:${pairAddress}`;
  }
}
