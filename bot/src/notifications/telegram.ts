import { logger } from '../utils/logger';
import type { PairConfig } from '../config';
import type { PriceData } from '../schema/encoder';

interface TelegramNotifierOptions {
  botToken: string;
  chatId: string;
  intervalMs: number;
  pairs: PairConfig[];
}

interface PriceSnapshot {
  symbol: string;
  chain: string;
  priceUsd: number;
  change24h: number;
  timestamp: number;
}

/**
 * Periodically sends formatted price digests to a Telegram channel.
 */
export class TelegramNotifier {
  private timer?: NodeJS.Timeout;
  private readonly pairOrder: string[];
  private readonly pairLabels: Map<string, string>;
  private readonly latest: Map<string, PriceSnapshot> = new Map();
  private isSending = false;

  constructor(private readonly options: TelegramNotifierOptions) {
    this.pairOrder = options.pairs.map((pair) => this.getPairKey(pair.chain, pair.pairAddress));
    this.pairLabels = new Map(
      options.pairs.map((pair) => [this.getPairKey(pair.chain, pair.pairAddress), pair.symbol])
    );
  }

  /**
   * Start the background interval that posts to Telegram.
   */
  public start(): void {
    if (this.timer) {
      return;
    }

    logger.info(
      `Telegram notifier enabled – sending digests every ${Math.round(
        this.options.intervalMs / 60000
      )} minutes`
    );

    // Fire-and-forget interval; errors logged inside sendDigest
    this.timer = setInterval(() => {
      this.sendDigest().catch((error) => {
        logger.error('Telegram digest failed:', error);
      });
    }, this.options.intervalMs);
  }

  /**
   * Stop interval when bot shuts down.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Record the latest price for a given pair so it can be included in the next digest.
   */
  public recordPrice(chain: string, pairAddress: string, data: PriceData): void {
    const key = this.getPairKey(chain, pairAddress);
    const symbol = this.pairLabels.get(key) ?? data.pair;

    this.latest.set(key, {
      chain,
      symbol,
      priceUsd: this.fromUint(data.priceUsd),
      change24h: data.priceChange24h / 100,
      timestamp: Number(data.timestamp),
    });
  }

  private async sendDigest(): Promise<void> {
    if (this.isSending || this.latest.size === 0) {
      return;
    }

    this.isSending = true;

    try {
      const lines: string[] = [];

      for (const key of this.pairOrder) {
        const snapshot = this.latest.get(key);
        if (!snapshot) {
          continue;
        }
        lines.push(this.formatLine(snapshot));
      }

      if (lines.length === 0) {
        return;
      }

      const header = `📊 Somnia Price Bot\n${new Date().toUTCString()}`;
      const message = `${header}\n\n${lines.join('\n')}`;

      await this.sendMessage(message);
      logger.info('Telegram price digest sent');
    } finally {
      this.isSending = false;
    }
  }

  private formatLine(snapshot: PriceSnapshot): string {
    const price = this.formatPrice(snapshot.priceUsd);
    const change = snapshot.change24h >= 0
      ? `+${snapshot.change24h.toFixed(2)}%`
      : `${snapshot.change24h.toFixed(2)}%`;

    const ageMinutes = Math.max(0, Math.floor((Date.now() / 1000 - snapshot.timestamp) / 60));
    const freshness = ageMinutes > 0 ? `${ageMinutes}m ago` : 'just now';

    return `${snapshot.symbol} (${snapshot.chain}): $${price} | 24h ${change} • ${freshness}`;
  }

  private formatPrice(value: number): string {
    if (value >= 1000) {
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    if (value >= 1) {
      return value.toFixed(4);
    }

    return value.toPrecision(3);
  }

  private fromUint(value: bigint): number {
    return Number(value) / 1e18;
  }

  private getPairKey(chain: string, pairAddress: string): string {
    return `${chain}:${pairAddress}`;
  }

  private async sendMessage(text: string): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${this.options.botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: this.options.chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram HTTP ${response.status}: ${errorText}`);
    }
  }
}
