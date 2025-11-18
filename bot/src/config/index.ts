import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
// Try multiple paths to find .env file
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    envLoaded = true;
    console.log(`Loaded .env from: ${envPath}`);
    break;
  }
}

if (!envLoaded) {
  dotenv.config(); // Try default location
}

export interface PairConfig {
  chain: string;
  pairAddress: string;
  symbol: string;
}

/**
 * Parse pairs from environment variable
 * Format: "solana:4RsXTiPDP3q...:SOL/USDC,ethereum:0xabc...:ETH/USDC"
 */
function parsePairs(pairsEnv: string | undefined): PairConfig[] {
  if (!pairsEnv) {
    throw new Error('PAIRS environment variable is required');
  }

  return pairsEnv.split(',').map((pairStr) => {
    const [chain, pairAddress, symbol] = pairStr.trim().split(':');
    if (!chain || !pairAddress || !symbol) {
      throw new Error(`Invalid pair format: ${pairStr}. Expected format: "chain:address:symbol"`);
    }
    return { chain, pairAddress, symbol };
  });
}

/**
 * Validate required environment variables
 */
function validateConfig() {
  const required = ['SOMNIA_RPC_URL', 'SOMNIA_PRIVATE_KEY', 'PAIRS', 'SOMNIA_SCHEMA_ID', 'PUBLISHER_ADDRESS'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate on load
validateConfig();

export const config = {
  // Somnia configuration
  somnia: {
    rpcUrl: process.env.SOMNIA_RPC_URL!,
    contractAddress: (process.env.SOMNIA_CONTRACT_ADDRESS || '0x6AB397FF662e42312c003175DCD76EfF69D048Fc') as `0x${string}`,
    privateKey: process.env.SOMNIA_PRIVATE_KEY! as `0x${string}`,
    schemaId: process.env.SOMNIA_SCHEMA_ID! as `0x${string}`,
    publisherAddress: process.env.PUBLISHER_ADDRESS! as `0x${string}`,
    batchSize: parseInt(process.env.BATCH_SIZE || '10', 10),
    batchIntervalMs: parseInt(process.env.BATCH_INTERVAL_MS || '5000', 10),
  },

  // DexScreener configuration
  dexscreener: {
    baseUrl: 'https://io.dexscreener.com/dex/sse',
    reconnectIntervalMs: parseInt(process.env.RECONNECT_INTERVAL_MS || '5000', 10),
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '10', 10),
  },

  // Trading pairs to monitor
  pairs: parsePairs(process.env.PAIRS),

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Performance tuning
  performance: {
    // Minimum time (ms) between updates for the same pair to prevent spam
    minUpdateIntervalMs: parseInt(process.env.MIN_UPDATE_INTERVAL_MS || '1000', 10),
    // Price change threshold to trigger update (0.01 = 1%)
    priceChangeThreshold: parseFloat(process.env.PRICE_CHANGE_THRESHOLD || '0.001'),
  },

  telegram: (() => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT_ID || '';
    const enabledFlag = process.env.TELEGRAM_NOTIFIER_ENABLED;
    const enabled = Boolean(botToken && chatId && enabledFlag !== 'false');

    return {
      enabled,
      botToken,
      chatId,
      intervalMs: parseInt(process.env.TELEGRAM_INTERVAL_MS || '300000', 10),
    } as const;
  })(),
} as const;

export default config;
