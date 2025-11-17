# Somnia Data Streams Integration Guide

## Overview

This bot integrates with Somnia Data Streams to publish real-time cryptocurrency price data.

## Schema Definition

The price data schema includes:

- `uint64 timestamp` - Unix timestamp
- `string pair` - Trading pair (e.g., "SOL/USDC")
- `string chain` - Blockchain network
- `uint256 priceUsd` - Price in USD (18 decimals)
- `uint256 liquidity` - Liquidity in USD (18 decimals)
- `uint256 volume24h` - 24h volume in USD (18 decimals)
- `int32 priceChange1h` - 1h price change in basis points (100 = 1%)
- `int32 priceChange24h` - 24h price change in basis points

## Registration Process

### 1. Set Up Environment

Create a `.env` file with:

```env
SOMNIA_RPC_URL=https://your-somnia-rpc-url
SOMNIA_PRIVATE_KEY=0xYourPrivateKey
```

### 2. Register the Schema

Run the registration script:

```bash
npm run register-schema
```

This will output a schema ID. Save it for the next step.

### 3. Update Configuration

Add the schema ID to your `.env`:

```env
SOMNIA_SCHEMA_ID=<your_schema_id>
PUBLISHER_ADDRESS=<your_wallet_address>
```

## Writing to Streams

### Single Update

```typescript
const priceData: PriceData = {
  timestamp: BigInt(Date.now() / 1000),
  pair: "SOL/USDC",
  chain: "solana",
  priceUsd: BigInt("123450000000000000000"), // $123.45 with 18 decimals
  liquidity: BigInt("5000000000000000000000000"),
  volume24h: BigInt("1000000000000000000000000"),
  priceChange1h: 150, // 1.5%
  priceChange24h: -250, // -2.5%
};

const encoded = encodePriceData(priceData);

await sdk.streams.set([
  {
    id: "solana:4RsXTiPDP3q...",
    schemaId: SCHEMA_ID,
    data: encoded,
  },
]);
```

### Batch Updates

The bot automatically batches updates for efficiency:

```typescript
const writer = new SomniaStreamsWriter({
  batchSize: 10,
  batchIntervalMs: 5000,
});

// Queue multiple updates
await writer.queueUpdate(chain, pairAddress, priceData1);
await writer.queueUpdate(chain, pairAddress, priceData2);

// Automatically flushed when batch size reached or interval expires
```

## Reading from Streams

### Frontend Subscription

```typescript
import { SomniaStreamsSDK } from "@somnia-chain/streams";

const sdk = new SomniaStreamsSDK({
  rpcUrl: SOMNIA_RPC_URL,
});

// Subscribe to updates
const subscription = await sdk.streams.subscribe({
  schemaId: SCHEMA_ID,
  publisher: PUBLISHER_ADDRESS,
  keys: ["solana:4RsXTiPDP3q...", "ethereum:0xabc..."],
  onUpdate: (update) => {
    const decoded = decodePriceData(update.data);
    console.log(`Price update: ${decoded.pair} = $${decoded.priceUsd}`);
  },
});

// Unsubscribe when done
subscription.unsubscribe();
```

## Data Key Format

Each trading pair uses a unique key:

```
{chain}:{pairAddress}
```

Examples:
- `solana:4RsXTiPDP3qPbHvXz8Xk1nJkq4eVz8...`
- `ethereum:0xabc123...`
- `base:0xdef456...`

## Error Handling

### Connection Errors

The bot automatically handles connection errors with exponential backoff:

```typescript
// Configured in config/index.ts
dexscreener: {
  reconnectIntervalMs: 5000,
  maxReconnectAttempts: 10,
}
```

### Write Errors

Failed writes are automatically retried:

```typescript
try {
  await this.writeToStreams(updates);
} catch (error) {
  logger.error('Failed to write to Somnia Streams:', error);
  
  // Re-queue failed updates
  for (const update of updates) {
    this.pendingUpdates.set(update.id, update);
  }
  
  // Retry after delay
  setTimeout(() => this.flush(), 5000);
}
```

## Performance Optimization

### Batching

- **Batch Size**: Group up to 10 updates per transaction
- **Batch Interval**: Flush every 5 seconds if batch not full

### Deduplication

- **Time Threshold**: Minimum 1 second between updates for same pair
- **Price Threshold**: Only update if price changed by 0.1% or more

### Configuration

```env
BATCH_SIZE=10
BATCH_INTERVAL_MS=5000
MIN_UPDATE_INTERVAL_MS=1000
PRICE_CHANGE_THRESHOLD=0.001
```

## Monitoring

The bot logs:
- Connection status for each pair
- Update frequency and batch sizes
- Errors and retry attempts
- Performance metrics

Check logs:
```bash
tail -f logs/combined.log
tail -f logs/error.log
```

## Troubleshooting

### Schema Not Found

Ensure you've registered the schema and set `SOMNIA_SCHEMA_ID` in `.env`.

### Permission Denied

Verify that the wallet address has permission to write to the stream.

### Rate Limiting

Adjust batch settings to reduce transaction frequency:

```env
BATCH_SIZE=20
BATCH_INTERVAL_MS=10000
```

### High Gas Costs

Increase batch size to reduce transaction count:

```env
BATCH_SIZE=50
```
