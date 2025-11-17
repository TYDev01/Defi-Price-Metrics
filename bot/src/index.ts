import { logger } from './utils/logger';
import { SSEHandler } from './sse/handler';
import { SomniaStreamsWriter } from './streams/writer';
import { PriceDeduplicator } from './utils/deduplicator';
import { parseDexScreenerUpdate, generatePairKey } from './schema/encoder';
import config from './config';

/**
 * Main application class
 */
class PriceStreamingBot {
  private sseHandler: SSEHandler;
  private streamsWriter: SomniaStreamsWriter;
  private deduplicator: PriceDeduplicator;
  private isRunning = false;

  constructor() {
    this.deduplicator = new PriceDeduplicator();

    this.streamsWriter = new SomniaStreamsWriter({
      batchSize: config.somnia.batchSize,
      batchIntervalMs: config.somnia.batchIntervalMs,
    });

    this.sseHandler = new SSEHandler({
      baseUrl: config.dexscreener.baseUrl,
      reconnectIntervalMs: config.dexscreener.reconnectIntervalMs,
      maxReconnectAttempts: config.dexscreener.maxReconnectAttempts,
      onUpdate: this.handlePriceUpdate.bind(this),
      onError: this.handleError.bind(this),
    });
  }

  /**
   * Start the bot
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    logger.info('Starting Price Streaming Bot');
    logger.info(`Monitoring ${config.pairs.length} pairs`);

    // Start monitoring each configured pair
    for (const pair of config.pairs) {
      this.sseHandler.startPair(pair);
    }

    this.isRunning = true;

    // Set up graceful shutdown
    this.setupShutdownHandlers();

    // Log status every 60 seconds
    this.startStatusReporting();
  }

  /**
   * Handle incoming price updates
   */
  private async handlePriceUpdate(chain: string, pairAddress: string, data: any): Promise<void> {
    const key = generatePairKey(chain, pairAddress);

    try {
      const priceData = parseDexScreenerUpdate(data);

      if (!priceData) {
        logger.debug(`No valid price data for ${key}`);
        return;
      }

      // Check if update should be processed
      if (!this.deduplicator.shouldUpdate(key, priceData)) {
        logger.debug(`Skipping duplicate update for ${key}`);
        return;
      }

      logger.info(`Price update for ${key}: ${priceData.pair} = $${Number(priceData.priceUsd) / 1e18}`);

      // Queue update for batch processing
      await this.streamsWriter.queueUpdate(chain, pairAddress, priceData);
    } catch (error) {
      logger.error(`Error processing update for ${key}:`, error);
    }
  }

  /**
   * Handle SSE errors
   */
  private handleError(chain: string, pairAddress: string, error: Error): void {
    const key = generatePairKey(chain, pairAddress);
    logger.error(`SSE error for ${key}:`, error.message);
  }

  /**
   * Start periodic status reporting
   */
  private startStatusReporting(): void {
    setInterval(() => {
      const status = this.sseHandler.getStatus();
      const connected = status.filter((s) => s.connected).length;
      const pending = this.streamsWriter.getPendingCount();

      logger.info(`Status: ${connected}/${status.length} pairs connected, ${pending} updates pending`);

      // Log individual pair status
      for (const pair of status) {
        if (!pair.connected) {
          logger.warn(`Pair ${pair.key} disconnected (${pair.reconnectAttempts} reconnect attempts)`);
        }
      }
    }, 60000); // Every 60 seconds
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Stop the bot
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping Price Streaming Bot');

    this.isRunning = false;

    // Stop all SSE connections
    this.sseHandler.stopAll();

    // Flush remaining updates
    await this.streamsWriter.shutdown();

    logger.info('Bot stopped successfully');
  }
}

// Start the bot
const bot = new PriceStreamingBot();

bot.start().catch((error) => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});
