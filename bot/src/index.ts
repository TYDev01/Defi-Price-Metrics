import { logger } from './utils/logger';
import { DexScreenerAPI } from './api/dexscreener';
import { SomniaStreamsWriter } from './streams/writer';
import { PriceDeduplicator } from './utils/deduplicator';
import { parseDexScreenerUpdate, generatePairKey } from './schema/encoder';
import config from './config';
import { TelegramNotifier } from './notifications/telegram';

/**
 * Main application class
 */
class PriceStreamingBot {
  private dexscreenerAPI: DexScreenerAPI;
  private streamsWriter: SomniaStreamsWriter;
  private deduplicator: PriceDeduplicator;
  private isRunning = false;
  private telegramNotifier?: TelegramNotifier;

  constructor() {
    this.deduplicator = new PriceDeduplicator();

    this.streamsWriter = new SomniaStreamsWriter({
      batchSize: config.somnia.batchSize,
      batchIntervalMs: config.somnia.batchIntervalMs,
    });

    this.dexscreenerAPI = new DexScreenerAPI({
      pollIntervalMs: 10000, // Poll every 10 seconds
      onUpdate: this.handlePriceUpdate.bind(this),
      onError: this.handleError.bind(this),
    });

    if (config.telegram.enabled) {
      this.telegramNotifier = new TelegramNotifier({
        botToken: config.telegram.botToken,
        chatId: config.telegram.chatId,
        intervalMs: config.telegram.intervalMs,
        pairs: config.pairs,
      });
    } else {
      logger.info('Telegram notifier disabled (missing config)');
    }
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
    logger.info('Using DexScreener REST API (polling every 10 seconds)');

    // Start monitoring each configured pair
    for (const pair of config.pairs) {
      this.dexscreenerAPI.startPair(pair);
    }

    this.isRunning = true;

    // Set up graceful shutdown
    this.setupShutdownHandlers();

    // Log status every 60 seconds
    this.startStatusReporting();

    // Kick off Telegram digest loop if configured
    this.telegramNotifier?.start();
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

      // Track price for Telegram notifications
      this.telegramNotifier?.recordPrice(chain, pairAddress, priceData);
    } catch (error) {
      logger.error(`Error processing update for ${key}:`, error);
    }
  }

  /**
   * Handle API errors
   */
  private handleError(chain: string, pairAddress: string, error: Error): void {
    const key = generatePairKey(chain, pairAddress);
    logger.error(`API error for ${key}:`, error.message);
  }

  /**
   * Start periodic status reporting
   */
  private startStatusReporting(): void {
    setInterval(() => {
      const status = this.dexscreenerAPI.getStatus();
      const polling = status.filter((s) => s.polling).length;
      const pending = this.streamsWriter.getPendingCount();

      logger.info(`Status: ${polling}/${status.length} pairs polling, ${pending} updates pending`);
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

    // Stop all polling
    this.dexscreenerAPI.stopAll();

    // Flush remaining updates
    await this.streamsWriter.shutdown();

    // Stop Telegram notifier interval
    this.telegramNotifier?.stop();

    logger.info('Bot stopped successfully');
  }
}

// Start the bot
const bot = new PriceStreamingBot();

bot.start().catch((error) => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});
