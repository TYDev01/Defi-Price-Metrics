# DefiPrice Markets

> 🚀 Real-Time Decentralized Crypto Price Streaming

DeFi Price Metrics is a decentralized real-time price streaming platform that connects the speed of off-chain Web3 market data with the trustlessness of on-chain storage — delivering lightning-fast, reactive price charts for traders, builders, and DeFi applications.

Built with a modern, high-performance architecture, the platform ingests live token prices from DexScreener, streams them through a resilient Node.js service via Server-Sent Events (SSE), publishes every update to Somnia Data Streams, and showcases the live market movement on a beautiful, interactive Next.js trading dashboard.

This creates a fully decentralized, verifiable, and reactive system where users anywhere in the world can watch token activity with sub-second latency — without relying on centralized servers or custodial APIs

![Trading Dashboard](dashboard.png)

## ✨ Features

- 📊 **Real-Time Price Streaming** - Live updates across multiple chains
- 🔗 **Somnia Data Streams** - Decentralized data publication and subscription
- 📈 **Interactive Charts** - TradingView-powered price charts with history
- 🎨 **Beautiful UI** - Dark trading theme with Shadcn UI components
- 🌊 **Smooth Animations** - Framer Motion powered price transitions
- 🔄 **Auto-Reconnect** - Resilient SSE connections with exponential backoff
- 📦 **Batch Optimization** - Efficient gas usage through batch transactions
- 🎯 **Smart Filtering** - Deduplicate and throttle redundant updates
- 🌐 **Multi-Chain** - Support for Ethereum, Solana, Base, Arbitrum, Polygon, BSC, Avalanche, Optimism, Fantom, Blast, Linea, Scroll, and more via config
- 📣 **Telegram Alerts** - Optional 5-minute digests that broadcast the latest prices to any Telegram channel
- 🔐 **Wallet-Gated Admin Tools** - Publisher wallet curates global markets while any user can maintain a private watchlist
- ☁️ **Firestore Persistence** - Admin-added pairs sync through Firebase so every dashboard shares the same curated list
- 🐳 **Docker Ready** - Complete containerization for easy deployment

## 🏗️ Architecture

```
DexScreener REST/SSE → Price Bot → Somnia Streams (on-chain) →  Dashboard
```

- **Price Bot**: Node.js/TypeScript backend that polls DexScreener, deduplicates updates, and batches Somnia writes
- **Somnia Streams**: Decentralized data layer for publishing/subscribing with schema-enforced payloads
- **Dashboard**: Next.js App Router UI with Zustand state, live Somnia polling, and DexScreener seeding

[📖 Read Full Architecture Documentation](./ARCHITECTURE.md)

## 🔗 Somnia Data Streams Integration

This project is **fully integrated with Somnia Data Streams SDK** (`@somnia-chain/streams`). The DApp:

- ✅ Uses the official Somnia SDK for reading and writing data
- ✅ Publishes real-time price updates to Somnia Data Streams on-chain
- ✅ Reads data from Somnia using `getByKey()` with schema decoding
- ✅ Computes schema IDs / hashes for each `chain:address` pair


## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- DexScreener pair addresses
- Somnia wallet with STT tokens (for publishing to Data Streams)
- (Optional) DexScreener API key for SSE authentication

### 1. Clone and Setup

```bash
git clone https://github.com/TYDev01/Defi-Price-Metrics.git
cd DefipriceMarkets
chmod +x setup.sh
./setup.sh
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env

cp dashboard/.env.example dashboard/.env.local
nano .env
nano dashboard/.env.local
```

Update with your configuration:

```env
SOMNIA_RPC_URL=https://dream-rpc.somnia.network
SOMNIA_PRIVATE_KEY=0xYourPrivateKey
SOMNIA_SCHEMA_ID=0x...
PAIRS=ethereum:0x8ad5...:WETH/USDC,solana:Czfq...:SOL/USDC,base:0x4c36...:WETH/USDbC

NEXT_PUBLIC_SOMNIA_RPC_URL=https://dream-rpc.somnia.network
NEXT_PUBLIC_SCHEMA_ID=0x...
NEXT_PUBLIC_PUBLISHER_ADDRESS=0x...
NEXT_PUBLIC_PAIR_KEYS=ethereum:0x8ad5...,solana:Czfq...,base:0x4c36...

# Optional Telegram notifications
TELEGRAM_BOT_TOKEN=123456:abcdef
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_NOTIFIER_ENABLED=true
TELEGRAM_INTERVAL_MS=300000

# Firebase (admin pairs persistence)
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Compute Schema ID

```bash
cd bot
npm run build
npm run register-schema
```

The script will compute the schema ID from your schema definition. Update `.env` with the returned `SOMNIA_SCHEMA_ID` (should be in hex format like `0x000...001`).

### 4. Start Services

**Option A: Development**
```bash
# Terminal 1: Bot
cd bot
npm run dev

# Terminal 2: Dashboard
cd dashboard
npm run dev
```

**Option B: Docker**
```bash
docker-compose up -d
```

**Option C: PM2 Production**
```bash
pm2 start ecosystem.config.js
cd dashboard
npm run build && npm start
```

Visit `http://localhost:3000` to see your dashboard!

## ⚙️ How It Works

1. **DexScreener polling** – The bot hits DexScreener’s REST endpoints (or SSE) for every entry listed in `PAIRS`.
2. **Normalization** – `schema/encoder.ts` converts raw values into the Somnia schema (timestamp, pair string, chain, price/liquidity/volume uint256, basis-point deltas).
3. **Batch writes** – `streams/writer.ts` hashes each `chain:pairAddress`, deduplicates updates, and batches them into Somnia’s `esstores` contract using the configured schema ID.
4. **Somnia storage** – Somnia stores the latest payload per hash. Any reader that knows the schema ID + key can fetch it.
5. **Dashboard polling** – `useSomniaStreams` hashes the same keys found in `NEXT_PUBLIC_PAIR_KEYS`, polls Somnia every 3 seconds, and updates the Zustand store. Until a Somnia value exists, it calls DexScreener once to seed the UI with live data.
6. **UI rendering** – Components such as `PairList`, `PairStats`, and `/pair/[id]` read from the store to animate prices, display compact liquidity/volume, and chart history.
7. **Telegram digests (optional)** – When configured, the bot buffers the freshest values for each pair and ships a Telegram summary every five minutes.

## 📁 Project Structure

```
DefipriceMarkets/
├── bot/                     # Price streaming backend
│   ├── src/
│   │   ├── config/         # Configuration management
│   │   ├── sse/            # SSE connection handling
│   │   ├── streams/        # Somnia streams integration
│   │   ├── schema/         # Data encoding/decoding
│   │   ├── utils/          # Logging, deduplication
│   │   └── index.ts        # Main entry point
│   ├── Dockerfile
│   └── package.json
│
├── dashboard/               # Next.js trading interface
│   ├── app/                # Next.js 14 App Router
│   │   ├── page.tsx        # Markets list
│   │   ├── pair/[id]/      # Individual pair view
│   │   └── heatmap/        # Market heatmap
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities and store
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── ecosystem.config.js     # PM2 configuration
├── setup.sh               # Quick setup script
├── .env.example
├── README.md              # This file
├── ARCHITECTURE.md        # Detailed architecture docs
└── DEPLOYMENT.md          # Deployment guide
```

## 🎯 Usage

### Adding New Pairs

1. Find pair on [DexScreener](https://dexscreener.com)
2. Get chain and address from URL
3. Add to `.env` for the bot **and** append the same `chain:address` to `dashboard/.env.local` → `NEXT_PUBLIC_PAIR_KEYS`

```env
PAIRS=...,base:0xNewPairAddress:WETH/USDC
NEXT_PUBLIC_PAIR_KEYS=...,base:0xNewPairAddress
```

4. Restart bot and dashboard so the env vars reload

### Monitoring

```bash
# PM2
pm2 logs defiprice-bot
pm2 monit

# Docker
docker-compose logs -f

# Manual
tail -f bot/logs/combined.log
```

### Admin Console (Publisher Only)

1. Visit `/admin` and click **Connect Wallet**.
2. Connect with the wallet that matches `PUBLISHER_ADDRESS` in `.env`.
3. Provide the chain + pair address (and optional label) to append it to the dashboard’s Firestore-backed registry (configure service-account env vars first).
4. Remind yourself to update the bot `.env` so Somnia keeps streaming the new market; Firestore keeps the dashboard lists in sync, but the bot still needs matching `PAIRS`.

### My Watch (Per Wallet)

1. Browse to `/watch` and connect any non-publisher wallet.
2. Add chain + pair address entries to build a private list. Everything is stored locally per wallet, never on-chain.
3. DexScreener pulls refresh roughly every 15 seconds so you always see live numbers.
4. Removing a card only affects your personal dashboard.

### Telegram Notifications (Optional)

1. Create a Telegram bot via [@BotFather](https://t.me/BotFather) and copy the API token.
2. Add the bot to your target channel or group and promote it if the chat is private.
3. Populate `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and (optionally) `TELEGRAM_INTERVAL_MS` in `.env`.
4. Restart the bot process. Every five minutes the latest prices will be posted as a digest; set `TELEGRAM_NOTIFIER_ENABLED=false` to pause alerts without removing secrets.

### Dashboard Pages

- `/` - Markets overview with live prices
- `/pair/[id]` - Detailed view with charts and stats
- `/heatmap` - Market heatmap showing gainers/losers

## 🔧 Configuration

### Bot Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `BATCH_SIZE` | Updates per transaction | 10 |
| `BATCH_INTERVAL_MS` | Flush interval | 5000 |
| `MIN_UPDATE_INTERVAL_MS` | Min time between updates | 1000 |
| `PRICE_CHANGE_THRESHOLD` | Min price change to publish | 0.001 |
| `RECONNECT_INTERVAL_MS` | SSE reconnect delay | 5000 |
| `MAX_RECONNECT_ATTEMPTS` | Max reconnect tries | 10 |

### Performance Tuning

**High Gas Costs?**
```env
BATCH_SIZE=20              # Larger batches
BATCH_INTERVAL_MS=10000    # Less frequent writes
```

**Too Many Updates?**
```env
PRICE_CHANGE_THRESHOLD=0.005  # Only 0.5%+ changes
MIN_UPDATE_INTERVAL_MS=2000   # Min 2s interval
```

### Telegram Alert Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | BotFather token for your Telegram bot | _required to enable_ |
| `TELEGRAM_CHAT_ID` | Channel/group/user chat ID (use negative ID for channels) | _required to enable_ |
| `TELEGRAM_NOTIFIER_ENABLED` | Set to `false` to disable without removing secrets | `true` |
| `TELEGRAM_INTERVAL_MS` | Interval between digests in milliseconds | `300000` (5 min) |

### Firebase Admin Settings (Dashboard Only)

| Variable | Description | Default |
|----------|-------------|---------|
| `FIREBASE_PROJECT_ID` | Firebase project id backing Firestore | _required for admin pairs_ |
| `FIREBASE_CLIENT_EMAIL` | Service-account client email with Firestore access | _required_ |
| `FIREBASE_PRIVATE_KEY` | Multiline private key (wrap in quotes, keep `\n`) | _required_ |

## 🐳 Docker Deployment

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose build && docker-compose up -d
```


## 🛠️ Development

### Bot Development

```bash
cd bot
npm run dev         # Development mode
npm run build       # Build TypeScript
npm run lint        # Lint code
npm run type-check  # Type checking
```

### Dashboard Development

```bash
cd dashboard
npm run dev         # Development server
npm run build       # Production build
npm run lint        # Lint code
npm run type-check  # Type checking
```

## 🔒 Security

**Never commit `.env` files!**

## 📊 Tech Stack

### Backend (Bot)
- Node.js 20+ with TypeScript
- **@somnia-chain/streams** (Somnia Data Streams SDK)
- EventSource (SSE client)
- Viem (Ethereum library)
- Winston (Logging)
- Dotenv (Configuration)

### Frontend (Dashboard)
- Next.js 14 (App Router)
- React 18 with TypeScript
- **@somnia-chain/streams** (Somnia Data Streams SDK)
- Zustand (State management)
- TailwindCSS (Styling)
- Shadcn UI (Components)
- Framer Motion (Animations)
- TradingView Lightweight Charts
- Lucide React (Icons)

### Infrastructure
- Docker & Docker Compose
- PM2 (Process management)
- Nginx (Reverse proxy)

## 🚀 Deployment Options

1. **Docker Compose** - Single command deployment
2. **PM2** - Production process management
3. **VPS** - DigitalOcean, Linode, Hetzner
4. **Serverless** - Bot on Railway/Render, Dashboard on Vercel
5. **Kubernetes** - For large-scale deployments

[📖 See Full Deployment Guide](./DEPLOYMENT.md)

## 📈 Performance

- **Bot**: Handles 100+ pairs simultaneously
- **Batch Processing**: 10+ updates per transaction
- **Deduplication**: Reduces updates by 70-90%
- **Dashboard**: 60fps smooth animations
- **Charts**: Handles 1000+ data points efficiently

## 🐛 Troubleshooting

### Bot Not Connecting

```bash
# Check logs
tail -f bot/logs/combined.log

# Verify environment
cd bot
npm run dev
```

### Dashboard Not Updating

1. Open browser DevTools console
2. Check for errors
3. Verify `NEXT_PUBLIC_*` variables
4. Confirm bot is running and Somnia schema ID / publisher match the values in `.env`

### High Memory Usage

```bash
# Increase PM2 limit
# In ecosystem.config.js
max_memory_restart: '1G'
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

MIT License 

## 🙏 Acknowledgments

- [DexScreener](https://dexscreener.com) - Price data source
- [Somnia](https://somnia.network) - Data Streams infrastructure
- [Next.js](https://nextjs.org) - React framework
- [Shadcn UI](https://ui.shadcn.com) - UI components
- [TradingView](https://www.tradingview.com) - Charting library



## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

*Real-time crypto prices, powered by DexScreener, Somnia, and Next.js 14*
