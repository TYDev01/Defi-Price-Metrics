import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../utils/logger';
import { encodePriceData, generatePairKey, PriceData } from '../schema/encoder';
import config from '../config';
import { defineChain } from 'viem';
import { SDK } from '@somnia-chain/streams';

const somniaChain = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: [config.somnia.rpcUrl] },
  },
});

export interface StreamUpdate {
  id: `0x${string}`;
  schemaId: `0x${string}`;
  data: `0x${string}`;
}

export interface BatchWriterOptions {
  batchSize: number;
  batchIntervalMs: number;
}

export class SomniaStreamsWriter {
  private account: ReturnType<typeof privateKeyToAccount>;
  private pendingUpdates: Map<string, StreamUpdate> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private options: BatchWriterOptions;
  private isWriting = false;

  private publicClient = createPublicClient({
    chain: somniaChain,
    transport: http(config.somnia.rpcUrl),
  });

  private walletClient = createWalletClient({
    account: privateKeyToAccount(config.somnia.privateKey),
    chain: somniaChain,
    transport: http(config.somnia.rpcUrl),
  });

  constructor(options: BatchWriterOptions) {
    this.options = options;
    this.account = privateKeyToAccount(config.somnia.privateKey);

    logger.info(
      `Somnia Streams Writer initialized for account: ${this.account.address}`,
    );
  }

  /**
   * Queue a price update for batching
   */
  public async queueUpdate(
    chain: string,
    pairAddress: string,
    priceData: PriceData,
  ): Promise<void> {
    const key = generatePairKey(chain, pairAddress);

    const update: StreamUpdate = {
      id: key,
      schemaId: config.somnia.schemaId,
      data: encodePriceData(priceData),
    };

    this.pendingUpdates.set(key, update);

    logger.debug(`Queued update for ${key}, pending: ${this.pendingUpdates.size}`);

    if (this.pendingUpdates.size >= this.options.batchSize) {
      await this.flush();
    } else {
      this.scheduleBatch();
    }
  }

  /**
   * Schedule batch write
   */
  private scheduleBatch(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => this.flush(), this.options.batchIntervalMs);
  }

  /**
   * Flush pending updates
   */
  public async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.pendingUpdates.size === 0 || this.isWriting) return;

    this.isWriting = true;

    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    logger.info(`Flushing ${updates.length} updates to Somnia Streams`);

    try {
      await this.writeToStreams(updates);
      logger.info(`Successfully wrote ${updates.length} updates`);
    } catch (error) {
      logger.error('Failed to write to Somnia Streams:', error);

      // requeue
      for (const update of updates) {
        this.pendingUpdates.set(update.id, update);
      }

      setTimeout(() => this.flush(), 5000);
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Correct Somnia write using the SDK
   */
  private async writeToStreams(updates: StreamUpdate[]): Promise<void> {
    const sdk = new SDK({
      public: this.publicClient,
      wallet: this.walletClient,
    });

    logger.debug(' Writing to Somnia Streams via SDK:', {
      count: updates.length,
      schemaId: config.somnia.schemaId,
      publisher: this.account.address,
    });

    const txHash = await sdk.streams.set(updates);

    if (!txHash) {
      throw new Error('Somnia returned no tx hash for write');
    }

    logger.info(`Somnia write tx: ${txHash}`);
  }

  /**
   * Cleanup
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down Somnia Streams Writer');

    if (this.batchTimer) clearTimeout(this.batchTimer);

    await this.flush();
  }

  public getPendingCount(): number {
    return this.pendingUpdates.size;
  }
}
