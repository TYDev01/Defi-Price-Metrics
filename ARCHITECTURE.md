# DefiPrice Markets - Architecture Documentation

## System Overview

DefiPrice Markets is a real-time cryptocurrency price streaming platform that now combines five key building blocks:

1. **DexScreener SSE** - Real-time price data source
2. **Somnia Data Streams** - Decentralized data publication layer
3. **Next.js 14 Dashboard** - Modern trading interface
4. **Firebase Firestore** - Publisher-controlled pair registry
5. **Telegram Bot** - Digest-style notifications for top movers

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        DexScreener Network                       │
│  (Multiple DEX Aggregators: Solana, Ethereum, Base, etc.)      │
└────────────────────────┬────────────────────────────────────────┘
                         │ SSE Stream (Server-Sent Events)
                         │ Real-time price updates
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Price Streaming Bot                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ SSE Handler  │→ │ Deduplicator │→ │  Batch Queue │         │
│  │  - Connect   │  │ - Filter     │  │  - Accumulate│         │
│  │  - Reconnect │  │ - Throttle   │  │  - Optimize  │         │
│  │  - Parse     │  │ - Validate   │  │  - Encode    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │ Batch Transactions
                             │ Encoded schema data
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Somnia Data Streams                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Schema: CryptoPriceData                                  │  │
│  │  - timestamp (uint64)                                     │  │
│  │  - pair (string)                                          │  │
│  │  - chain (string)                                         │  │
│  │  - priceUsd (uint256)                                     │  │
│  │  - liquidity (uint256)                                    │  │
│  │  - volume24h (uint256)                                    │  │
│  │  - priceChange1h (int32)                                  │  │
│  │  - priceChange24h (int32)                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ Subscribe to updates
                             │ Real-time pub/sub
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Trading Dashboard (Next.js 14)                │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Zustand Store   │←─│ Somnia Hook  │←─│ React Query  │      │
│  │ - Price state   │  │ - Subscribe  │  │ - Cache      │      │
│  │ - History       │  │ - Decode     │  │ - Hydrate    │      │
│  │ - Admin pairs   │  │ - Transform  │  │              │      │
│  └────────┬────────┘  └──────────────┘  └──────────────┘      │
│           │                                                      │
│  ┌────────▼─────────────────────────────────────────────────┐  │
│  │  Firestore API Route (/api/admin/pairs)                   │  │
│  │  - Wallet-gated CRUD                                      │  │
│  │  - Firebase Admin SDK                                     │  │
│  │  - Persists global pairs                                  │  │
│  └────────┬──────────────────────────────────────────────────┘  │
│           │                                                      │
│  ┌────────▼─────────────────────────────────────────────────┐  │
│  │              UI Components                                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │ PairList │ │  Chart   │ │ Heatmap  │ │  Stats   │   │  │
│  │  │ Admin    │ │ Watch    │ │ Header   │ │ Telegram │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                    Browser & Telegram Clients
```

## Component Details

### 1. Price Streaming Bot

**Technology Stack:**
- Node.js 20+ with TypeScript
- EventSource for SSE connections
- Viem for blockchain interactions
- Winston for logging

**Responsibilities:**
1. **Connection Management**
   - Establish SSE connections to DexScreener
   - Auto-reconnect with exponential backoff
   - Handle network failures gracefully

2. **Data Processing**
   - Parse incoming price events
   - Validate data integrity
   - Transform to internal schema

3. **Optimization**
   - Deduplicate redundant updates
   - Batch multiple updates
   - Throttle high-frequency changes

4. **Publishing**
   - Encode data to Somnia schema
   - Write to Data Streams
   - Handle write failures and retries

**Key Files:**
```
bot/src/
├── index.ts                 # Main entry point
├── config/index.ts          # Configuration management
├── sse/handler.ts           # SSE connection logic
├── streams/writer.ts        # Somnia streams integration
├── schema/encoder.ts        # Data encoding/decoding
└── utils/
    ├── logger.ts            # Winston logger setup
    └── deduplicator.ts      # Update filtering
```

### 2. Somnia Data Streams Layer

**Schema Definition:**
```typescript
interface CryptoPriceData {
  timestamp: uint64      // Unix timestamp (seconds)
  pair: string           // Trading pair symbol
  chain: string          // Blockchain network
  priceUsd: uint256      // Price in USD (18 decimals)
  liquidity: uint256     // Pool liquidity (18 decimals)
  volume24h: uint256     // 24h trading volume (18 decimals)
  priceChange1h: int32   // 1h % change (basis points)
  priceChange24h: int32  // 24h % change (basis points)
}
```

**Data Flow:**
```
Write Flow:
Bot → Encode Data → Transaction → Somnia Chain → Event Emission

Read Flow:
Subscribe Request → Somnia RPC → Event Stream → Dashboard
```

**Key Operations:**
- `registerSchema()` - One-time schema registration
- `streams.set()` - Write price updates
- `streams.subscribe()` - Subscribe to updates

### 3. Next.js 14 Dashboard

**Technology Stack:**
- Next.js 14 with App Router
- React 18 with TypeScript
- Zustand for state management
- TailwindCSS + Shadcn UI
- Framer Motion for animations
- TradingView Lightweight Charts
- Firebase Admin SDK (server routes)
- Telegram Bot API (server-side cron/digest)

**Architecture Patterns:**

1. **State Management (Zustand)**
```typescript
interface PriceStore {
  pairs: Map<string, PairState>
  updatePair: (key, data) => void
  addHistoryPoint: (key, time, value) => void
  isConnected: boolean
  error: string | null
}
```

2. **Real-time Updates**
```typescript
useEffect(() => {
  const subscription = sdk.streams.subscribe({
    schemaId,
    publisher,
    keys: pairKeys,
    onUpdate: (update) => {
      const decoded = decodePriceData(update.data)
      updatePair(update.id, decoded)
    }
  })
  return () => subscription.unsubscribe()
}, [])
```

3. **Component Structure**
```
components/
├── Header.tsx           # Navigation and branding
├── PairList.tsx         # Market overview grid
├── PriceHeader.tsx      # Individual pair header
├── TradingChart.tsx     # Price chart component
├── PairStats.tsx        # Statistics panel
├── Heatmap.tsx          # Market heatmap
└── ui/                  # Shadcn UI components
```

**Key Files:**
```
dashboard/
├── app/
│   ├── layout.tsx                # Root layout with wallet + registry providers
│   ├── page.tsx                  # Markets list page
│   ├── pair/[id]/page.tsx        # Individual pair page
│   ├── heatmap/page.tsx          # Heatmap page
│   ├── watch/page.tsx            # Wallet-local watchlists
│   ├── admin/page.tsx            # Wallet-gated admin interface
│   └── api/admin/pairs/route.ts  # Firestore CRUD endpoint
├── components/                   # React components
├── hooks/
│   ├── useSomniaStreams.ts       # Streams subscription hook
│   └── useWalletStore.ts         # Wallet connection + publisher check
└── lib/
   ├── store.ts                  # Zustand price store
   ├── pair-registry.ts          # Base + admin pair registry state machine
   ├── firebase-admin.ts         # Server-side Firestore bootstrap
   └── utils.ts                  # Helper functions
```

### 4. Admin Pair Management & Persistence

**Workflow:**
1. Publisher wallet connects via `useWalletStore`.
2. Admin UI calls `addAdminPair` / `removeAdminPair` from `pair-registry.ts`.
3. Registry hits `/api/admin/pairs` with the wallet address for authorization.
4. Route initializes Firebase Admin (shared `.env` secrets) and writes the pair to Firestore (`adminPairs` collection keyed by `chain:address`).
5. Registry refresh merges Firestore-administered pairs with `.env` base pairs and rehydrates Zustand/Somnia subscriptions.

**Security Controls:**
- Wallet gating enforced server-side (`NEXT_PUBLIC_PUBLISHER_ADDRESS`).
- Firestore service account keys provided via root `.env` and loaded dynamically in both dev and prod.
- REST calls validated for duplicates and missing data before persistence.

**Bot Consideration:**
- Bot still reads `.env` pairs; when admins add pairs they should also sync bot config until Firestore ingestion is automated.

### 5. Telegram Digest Notifications

- `bot` process optionally instantiates a Telegram notifier (controlled via `TELEGRAM_NOTIFIER_ENABLED`).
- Every 5 minutes (configurable), it aggregates gainers/losers based on recent Somnia/DexScreener data and sends formatted markdown to `TELEGRAM_CHAT_ID`.
- Digest styling highlights top moves, CTA button invites users back to the dashboard.
- Notifications can be disabled without removing credentials, simplifying staging vs production toggles.

## Data Flow

### 1. Price Update Flow

```
DexScreener SSE Event
    ↓
SSE Handler receives raw data
    ↓
Parse JSON to DexScreenerUpdate
    ↓
Transform to PriceData schema
    ↓
Deduplicator checks:
  - Time since last update > threshold?
  - Price change > threshold?
    ↓
Add to batch queue
    ↓
Batch full OR interval elapsed?
    ↓
Encode all updates to ABI format
    ↓
Write transaction to Somnia
    ↓
Somnia emits update event
    ↓
Dashboard subscription receives event
    ↓
Decode ABI to PriceData
    ↓
Update Zustand store
    ↓
React components re-render
    ↓
UI updates with new price
```


### 2. Admin Pair Flow

```
Publisher connects wallet
   ↓
`pair-registry.addAdminPair()` invoked
   ↓
Client POST /api/admin/pairs (wallet address, chain, address, label)
   ↓
Route validates publisher wallet + normalizes payload
   ↓
Firebase Admin writes/updates Firestore `adminPairs` doc
   ↓
Registry refresh merges Firestore pairs into Zustand store
   ↓
Components subscribe to expanded pair list and trigger Somnia subscriptions
```

### 3. Telegram Digest Flow

```
Scheduler tick (default 5 min)
   ↓
Collect latest price snapshots
   ↓
Rank top movers (up/down)
   ↓
Format markdown digest + CTA deep links
   ↓
POST to Telegram Bot API
   ↓
Users receive digest in configured channel
```

```
New price arrives in store
    ↓
addHistoryPoint(key, time, value)
    ↓
Append to history array
    ↓
Trim to max 1000 points
    ↓
TradingChart useEffect triggered
    ↓
series.setData(history)
    ↓
Chart redraws with new point
```

## Performance Optimizations

### Bot Level

1. **Batch Processing**
   - Accumulate multiple updates
   - Single transaction for efficiency
   - Configurable batch size

2. **Deduplication**
   - Compare with last price
   - Check time interval
   - Filter insignificant changes

3. **Connection Pooling**
   - Reuse SSE connections
   - Graceful reconnection
   - Exponential backoff

### Dashboard Level

1. **State Management**
   - Zustand for lightweight state
   - Map-based storage for O(1) lookups
   - Dedicated pair registry store handles Firestore hydration & deduplication

2. **Chart Optimization**
   - Limit history to 1000 points
   - Efficient data updates
   - Canvas-based rendering

3. **Code Splitting**
   - Route-based splitting (markets, heatmap, pair, watch, admin)
   - Dynamic imports
   - Lazy loading

## Scalability Considerations

### Horizontal Scaling

**Bot:**
- Run multiple instances with different pair subsets
- Each instance handles subset of pairs
- No shared state required

**Dashboard:**
- Deploy multiple instances behind load balancer
- Stateless design enables easy scaling
- CDN for static assets

### Vertical Scaling

**Bot:**
- Increase batch size for more throughput
- Add more CPU for concurrent processing
- More memory for larger batches

**Dashboard:**
- More connections per instance
- Larger cache for historical data
- Better hardware for chart rendering

## Security Model

### Bot Security

1. **Private Key Management**
   - Never committed to repo
   - Environment variables only
   - Encrypted at rest

2. **RPC Security**
   - HTTPS only
   - Rate limiting
   - Error handling

3. **Input Validation**
   - Sanitize SSE data
   - Validate schema compliance
   - Type checking

### Dashboard Security

1. **Wallet-Gated Admin**
   - Publisher wallet required for global pair CRUD
   - Server verifies wallet matches `NEXT_PUBLIC_PUBLISHER_ADDRESS`
   - Firestore writes never exposed to non-admin users

2. **XSS Protection**
   - React escaping
   - Content Security Policy
   - Input sanitization

3. **Rate Limiting**
   - Subscription throttling
   - Request limits on admin API route
   - Error boundaries

## Monitoring and Observability

### Metrics to Track

**Bot:**
- SSE connection status
- Update frequency per pair
- Batch sizes and intervals
- Write success/failure rates
- Memory and CPU usage

**Dashboard:**
- Page load time
- Component render time
- WebSocket connection status
- User interactions
- Error rates

### Logging Strategy

**Bot:**
```
INFO:  Normal operations
WARN:  Recoverable errors
ERROR: Critical failures
DEBUG: Detailed diagnostics
```

**Dashboard:**
```javascript
console.log()   // Development only
Sentry          // Production errors
Analytics       // User behavior
```

## Deployment Architectures

### Option 1: Monolithic VPS

```
Single VPS (4GB RAM, 2 CPU)
├── Bot (PM2)
├── Dashboard (PM2)
├── Nginx (Reverse Proxy)
└── Let's Encrypt (SSL)
```

**Pros:** Simple, cost-effective
**Cons:** Single point of failure

### Option 2: Microservices

```
Bot Service (Railway)
    ↓ Writes to
Somnia Streams
    ↓ Read by
Dashboard (Vercel)
    ↓ Served to
Users (Global CDN)
```

**Pros:** Scalable, managed
**Cons:** More complex, higher cost

### Option 3: Containerized

```
Docker Host
├── Bot Container
├── Dashboard Container
└── Nginx Container
```

**Pros:** Portable, isolated
**Cons:** Requires Docker knowledge

## Future Enhancements

### Planned Features

1. **Historical Data**
   - Store price history
   - Candlestick charts
   - Time-range queries

2. **Advanced Analytics**
   - Volume analysis
   - Liquidity tracking
   - Volatility metrics

3. **Alerts System**
   - Price notifications
   - Webhook integration
   - Email/SMS alerts

4. **Multi-DEX Support**
   - Jupiter (Solana)
   - Uniswap (Ethereum)
   - PancakeSwap (BSC)

### Technical Improvements

1. **WebSocket Alternative**
   - Replace SSE with WS
   - Better connection handling
   - Lower latency

2. **Caching Layer**
   - Redis for hot data
   - Reduce blockchain reads
   - Faster dashboard loads

3. **Database Integration**
   - PostgreSQL for history
   - TimescaleDB for time-series
   - Analytics queries

## Troubleshooting Guide

### Common Issues

1. **Bot Not Connecting**
   - Check environment variables
   - Verify Somnia RPC endpoint
   - Confirm private key format

2. **Dashboard Not Updating**
   - Check browser console
   - Verify subscription keys
   - Confirm bot is running

3. **Admin Pair Add Fails**
   - Ensure Firebase env vars are loaded (root `.env` or deployment secrets)
   - Confirm wallet matches publisher address
   - Check Firestore IAM permissions for the service account

4. **High Gas Costs**
   - Increase batch size
   - Raise price threshold
   - Extend batch interval

## References

- [Somnia Documentation](https://docs.somnia.network)
- [DexScreener API](https://docs.dexscreener.com)
- [Next.js 14 Docs](https://nextjs.org/docs)
- [TradingView Charts](https://www.tradingview.com/lightweight-charts/)

---

**Last Updated:** November 2025
**Version:** 1.0.0
**Maintainer:** DefiPrice Team
