import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../utils/logger';
import { encodePriceData, generatePairKey, PriceData } from '../schema/encoder';
import config from '../config';
import { defineChain } from 'viem';

const somniaChain = defineChain({
  id: 50311,
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

  constructor(options: BatchWriterOptions) {
    this.options = options;
    this.account = privateKeyToAccount(config.somnia.privateKey);

    logger.info(`Somnia Streams Writer initialized for account: ${this.account.address}`);
  }

  /**
   * Queue a price update for batching
   */
  public async queueUpdate(chain: string, pairAddress: string, priceData: PriceData): Promise<void> {
    const key = generatePairKey(chain, pairAddress);

    const update: StreamUpdate = {
      id: key, // key is already 0x-prefixed from keccak256
      schemaId: config.somnia.schemaId,
      data: encodePriceData(priceData),
    };

    this.pendingUpdates.set(key, update);

    logger.debug(`Queued update for ${key}, pending: ${this.pendingUpdates.size}`);

    // Trigger immediate write if batch size reached
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
    if (this.batchTimer) {
      return; // Timer already scheduled
    }

    this.batchTimer = setTimeout(() => {
      this.flush();
    }, this.options.batchIntervalMs);
  }

  /**
   * Flush pending updates to Somnia Streams
   */
  public async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.pendingUpdates.size === 0 || this.isWriting) {
      return;
    }

    this.isWriting = true;

    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    logger.info(`Flushing ${updates.length} updates to Somnia Streams`);

    try {
      await this.writeToStreams(updates);
      logger.info(`Successfully wrote ${updates.length} updates to Somnia Streams`);
    } catch (error) {
      logger.error('Failed to write to Somnia Streams:', error);
      
      // Re-queue failed updates
      for (const update of updates) {
        this.pendingUpdates.set(update.id, update);
      }
      
      // Retry after delay
      setTimeout(() => {
        this.flush();
      }, 5000);
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Write updates to Somnia Streams using custom contract address
   */
  private async writeToStreams(updates: StreamUpdate[]): Promise<void> {
    logger.debug('Writing to Somnia Streams:', {
      count: updates.length,
      schemaId: config.somnia.schemaId.toString(),
      publisher: this.account.address,
      contractAddress: config.somnia.contractAddress,
    });

    try {
      // Write directly to the custom contract address
      await this.writeDirectToContract(updates);
      logger.info(`Successfully wrote to Somnia contract ${config.somnia.contractAddress}`);
    } catch (error: any) {
      logger.error('Somnia write error:', error);
      throw error;
    }
  }

  /**
   * Write directly to custom contract address
   */
  private async writeDirectToContract(updates: StreamUpdate[]): Promise<void> {
    const walletClient = createWalletClient({
      account: this.account,
      chain: somniaChain,
      transport: http(config.somnia.rpcUrl),
    });

    // ABI for the esstores function
    const abi = [
      {
        inputs: [
          {
            components: [
              { name: 'id', type: 'bytes32' },
              { name: 'schemaId', type: 'bytes32' },
              { name: 'data', type: 'bytes' },
            ],
            name: 'dataStreams',
            type: 'tuple[]',
          },
        ],
        name: 'esstores',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ] as const;

    const txHash = await walletClient.writeContract({
      address: config.somnia.contractAddress,
      abi,
      functionName: 'esstores',
      args: [updates as any],
    });

    logger.info(`Somnia write transaction: ${txHash}`);
  }

  /**
   * Cleanup and flush on shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down Somnia Streams Writer');
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    await this.flush();
  }

  /**
   * Get pending update count
   */
  public getPendingCount(): number {
    return this.pendingUpdates.size;
  }
}
