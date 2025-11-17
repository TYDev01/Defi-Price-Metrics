import EventSource from 'eventsource';
import { logger } from '../utils/logger';
import { PairConfig } from '../config';
import { DexScreenerUpdate } from '../schema/encoder';

export interface SSEHandlerOptions {
  baseUrl: string;
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
  onUpdate: (chain: string, pairAddress: string, data: DexScreenerUpdate) => void;
  onError: (chain: string, pairAddress: string, error: Error) => void;
}

export class SSEHandler {
  private connections: Map<string, EventSource> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private options: SSEHandlerOptions;

  constructor(options: SSEHandlerOptions) {
    this.options = options;
  }

  /**
   * Start monitoring a trading pair
   */
  public startPair(pair: PairConfig): void {
    const key = this.getPairKey(pair.chain, pair.pairAddress);
    
    if (this.connections.has(key)) {
      logger.warn(`Pair ${pair.symbol} (${key}) is already being monitored`);
      return;
    }

    logger.info(`Starting SSE connection for ${pair.symbol} (${key})`);
    this.connect(pair);
  }

  /**
   * Stop monitoring a trading pair
   */
  public stopPair(chain: string, pairAddress: string): void {
    const key = this.getPairKey(chain, pairAddress);
    this.disconnect(key);
  }

  /**
   * Stop all connections
   */
  public stopAll(): void {
    logger.info('Stopping all SSE connections');
    
    for (const key of this.connections.keys()) {
      this.disconnect(key);
    }
  }

  /**
   * Get connection status
   */
  public getStatus(): Array<{ key: string; connected: boolean; reconnectAttempts: number }> {
    const status = [];
    
    for (const [key, connection] of this.connections.entries()) {
      status.push({
        key,
        connected: connection.readyState === EventSource.OPEN,
        reconnectAttempts: this.reconnectAttempts.get(key) || 0,
      });
    }
    
    return status;
  }

  /**
   * Create SSE connection for a pair
   */
  private connect(pair: PairConfig): void {
    const key = this.getPairKey(pair.chain, pair.pairAddress);
    const url = `${this.options.baseUrl}/${pair.chain}/${pair.pairAddress}`;

    try {
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        logger.info(`SSE connection opened for ${pair.symbol} (${key})`);
        this.reconnectAttempts.set(key, 0);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as DexScreenerUpdate;
          this.options.onUpdate(pair.chain, pair.pairAddress, data);
        } catch (error) {
          logger.error(`Failed to parse SSE message for ${key}:`, error);
        }
      };

      eventSource.onerror = (error) => {
        logger.error(`SSE connection error for ${pair.symbol} (${key}):`, error);
        
        const err = error instanceof Error ? error : new Error('SSE connection error');
        this.options.onError(pair.chain, pair.pairAddress, err);
        
        this.handleReconnect(pair);
      };

      this.connections.set(key, eventSource);
    } catch (error) {
      logger.error(`Failed to create SSE connection for ${key}:`, error);
      this.handleReconnect(pair);
    }
  }

  /**
   * Disconnect and cleanup a connection
   */
  private disconnect(key: string): void {
    const connection = this.connections.get(key);
    if (connection) {
      connection.close();
      this.connections.delete(key);
      logger.info(`SSE connection closed for ${key}`);
    }

    const timeout = this.reconnectTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(key);
    }

    this.reconnectAttempts.delete(key);
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(pair: PairConfig): void {
    const key = this.getPairKey(pair.chain, pair.pairAddress);
    
    // Close existing connection
    const connection = this.connections.get(key);
    if (connection) {
      connection.close();
      this.connections.delete(key);
    }

    const attempts = this.reconnectAttempts.get(key) || 0;
    
    if (attempts >= this.options.maxReconnectAttempts) {
      logger.error(
        `Max reconnect attempts (${this.options.maxReconnectAttempts}) reached for ${pair.symbol} (${key})`
      );
      return;
    }

    this.reconnectAttempts.set(key, attempts + 1);

    // Exponential backoff: 5s, 10s, 20s, 40s, etc.
    const backoffMs = this.options.reconnectIntervalMs * Math.pow(2, attempts);
    
    logger.info(
      `Reconnecting to ${pair.symbol} (${key}) in ${backoffMs}ms (attempt ${attempts + 1}/${this.options.maxReconnectAttempts})`
    );

    const timeout = setTimeout(() => {
      this.reconnectTimeouts.delete(key);
      this.connect(pair);
    }, backoffMs);

    this.reconnectTimeouts.set(key, timeout);
  }

  /**
   * Generate unique key for a pair
   */
  private getPairKey(chain: string, pairAddress: string): string {
    return `${chain}:${pairAddress}`;
  }
}
