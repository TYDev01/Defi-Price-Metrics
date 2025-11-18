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
  private readonly pairLabels: Map<string, string>;
  private readonly latest: Map<string, PriceSnapshot> = new Map();
  private isSending = false;

  constructor(private readonly options: TelegramNotifierOptions) {
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
      const snapshots = Array.from(this.latest.values());
      const gainers = this.selectMovers(snapshots, 'up');
      const losers = this.selectMovers(snapshots, 'down');

      if (gainers.length === 0 && losers.length === 0) {
        return;
      }

      const sections: string[] = [];
      sections.push(`📊 Somnia Price Bot\n🕒 ${new Date().toUTCString()}`);

      if (gainers.length) {
        const lines = gainers.map((snapshot) => this.formatLine(snapshot, 'up'));
        sections.push(`\n🚀 Top Gainers (24h)\n${lines.join('\n')}`);
      }

      if (losers.length) {
        const lines = losers.map((snapshot) => this.formatLine(snapshot, 'down'));
        sections.push(`\n📉 Top Losers (24h)\n${lines.join('\n')}`);
      }

      const message = sections.join('\n');

      await this.sendMessage(message);
      logger.info('Telegram price digest sent');
    } finally {
      this.isSending = false;
    }
  }

  private formatLine(snapshot: PriceSnapshot, direction: 'up' | 'down'): string {
    const price = this.formatPrice(snapshot.priceUsd);
    const changeValue = snapshot.change24h;
    const change = changeValue >= 0
      ? `+${changeValue.toFixed(2)}%`
      : `${changeValue.toFixed(2)}%`;

    const ageMinutes = Math.max(0, Math.floor((Date.now() / 1000 - snapshot.timestamp) / 60));
    const freshness = ageMinutes > 0 ? `${ageMinutes}m ago` : 'just now';
    const trendIcon = direction === 'up' ? '🟢' : '🔴';

    return `${trendIcon} ${snapshot.symbol} (${snapshot.chain}) — $${price} | 24h ${change} • ${freshness}`;
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

  private selectMovers(snapshots: PriceSnapshot[], direction: 'up' | 'down'): PriceSnapshot[] {
    if (snapshots.length === 0) {
      return [];
    }

    const filtered = snapshots
      .slice()
      .sort((a, b) => direction === 'up' ? b.change24h - a.change24h : a.change24h - b.change24h);

    if (direction === 'up') {
      const positive = filtered.filter((snapshot) => snapshot.change24h > 0);
      if (positive.length >= 3) {
        return positive.slice(0, 3);
      }
      return filtered.slice(0, Math.min(3, filtered.length));
    }

    const negative = filtered.filter((snapshot) => snapshot.change24h < 0);
    if (negative.length >= 3) {
      return negative.slice(0, 3);
    }
    return filtered.slice(0, Math.min(3, filtered.length));
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
