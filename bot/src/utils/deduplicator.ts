import { PriceData } from '../schema/encoder';
import config from '../config';

export interface CachedPrice {
  priceUsd: bigint;
  timestamp: number;
}

/**
 * Deduplicator to prevent redundant updates
 */
export class PriceDeduplicator {
  private cache: Map<string, CachedPrice> = new Map();

  /**
   * Check if update should be processed based on:
   * 1. Time since last update
   * 2. Price change threshold
   */
  public shouldUpdate(key: string, priceData: PriceData): boolean {
    const cached = this.cache.get(key);

    if (!cached) {
      // First update for this pair
      this.updateCache(key, priceData);
      return true;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - cached.timestamp;

    // Check minimum time interval
    if (timeSinceLastUpdate < config.performance.minUpdateIntervalMs) {
      return false;
    }

    // Check price change threshold
    const priceChange = this.calculatePriceChange(cached.priceUsd, priceData.priceUsd);
    
    if (Math.abs(priceChange) < config.performance.priceChangeThreshold) {
      return false;
    }

    // Update passed all checks
    this.updateCache(key, priceData);
    return true;
  }

  /**
   * Calculate relative price change
   */
  private calculatePriceChange(oldPrice: bigint, newPrice: bigint): number {
    if (oldPrice === 0n) return 1;
    
    const change = Number(newPrice - oldPrice) / Number(oldPrice);
    return change;
  }

  /**
   * Update cache
   */
  private updateCache(key: string, priceData: PriceData): void {
    this.cache.set(key, {
      priceUsd: priceData.priceUsd,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for a specific pair
   */
  public clearPair(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  public clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }
}
