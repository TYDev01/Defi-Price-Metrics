import { SDK } from '@somnia-chain/streams';
import { createWalletClient, createPublicClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const somniaChain = defineChain({
  id: 50311,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.SOMNIA_RPC_URL || ''] },
  },
});

/**
 * Schema Registration Script for Somnia Data Streams
 * 
 * This script registers the price data schema with Somnia.
 * Run once before starting the bot.
 */

const PRICE_SCHEMA = 'uint64 timestamp, string pair, string chain, uint256 priceUsd, uint256 liquidity, uint256 volume24h, int32 priceChange1h, int32 priceChange24h';

const SCHEMA_DEFINITION = {
  name: 'CryptoPriceData',
  version: '1.0.0',
  description: 'Real-time cryptocurrency price data from DexScreener',
  fields: [
    { name: 'timestamp', type: 'uint64', description: 'Unix timestamp' },
    { name: 'pair', type: 'string', description: 'Trading pair (e.g., SOL/USDC)' },
    { name: 'chain', type: 'string', description: 'Blockchain network' },
    { name: 'priceUsd', type: 'uint256', description: 'Price in USD (18 decimals)' },
    { name: 'liquidity', type: 'uint256', description: 'Liquidity in USD (18 decimals)' },
    { name: 'volume24h', type: 'uint256', description: '24h volume in USD (18 decimals)' },
    { name: 'priceChange1h', type: 'int32', description: '1h price change in basis points' },
    { name: 'priceChange24h', type: 'int32', description: '24h price change in basis points' },
  ],
};

async function registerSchema() {
  console.log('Registering Somnia Data Streams Schema...\n');

  // Validate environment
  const rpcUrl = process.env.SOMNIA_RPC_URL;
  const privateKey = process.env.SOMNIA_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error('Missing SOMNIA_RPC_URL or SOMNIA_PRIVATE_KEY in environment');
  }

  // Initialize Somnia SDK
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: somniaChain,
    transport: http(rpcUrl),
  });

  const sdk = new SDK({
    public: publicClient,
    wallet: walletClient,
  });

  console.log(`📝 Schema Name: ${SCHEMA_DEFINITION.name}`);
  console.log(`📝 Schema Version: ${SCHEMA_DEFINITION.version}`);
  console.log(`📝 Publisher Address: ${account.address}\n`);

  console.log('Schema Fields:');
  SCHEMA_DEFINITION.fields.forEach((field, index) => {
    console.log(`  ${index + 1}. ${field.name} (${field.type}) - ${field.description}`);
  });
  console.log('');

  // Compute schema ID from schema string
  console.log('Computing schema ID...');
  const schemaId = await sdk.streams.computeSchemaId(PRICE_SCHEMA);
  
  console.log(`\nSchema ID: ${schemaId}`);
  console.log(`Schema String: ${PRICE_SCHEMA}\n`);

  console.log('📋 Update your .env file with:');
  console.log(`SOMNIA_SCHEMA_ID=${schemaId}`);
  console.log(`PUBLISHER_ADDRESS=${account.address}\n`);

  console.log('Schema registration process completed');
}

// Run the script
registerSchema()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nError:', error);
    process.exit(1);
  });
