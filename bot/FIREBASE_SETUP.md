# Firebase Dynamic Pair Sync Setup

The bot now supports dynamically loading pairs added through the admin panel!

## How It Works

1. **Static Pairs** (always monitored): Pairs from `PAIRS` env variable
2. **Dynamic Pairs** (synced every 60s): Pairs added via admin panel → stored in Firebase
3. Bot automatically starts/stops monitoring when pairs are added/removed

## Setup Firebase Service Account

### 1. Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Project Settings** (gear icon)
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Download the JSON file

### 2. Save the Service Account File

Place the downloaded JSON file as:
```
/home/tony/Desktop/Dev/Protocols/Somnia/DefipriceMarkets/firebase-service-account.json
```

Or set the path in your `.env`:
```bash
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/your/firebase-service-account.json
```

### 3. Restart the Bot

```bash
cd /home/tony/Desktop/Dev/Protocols/Somnia/DefipriceMarkets/bot
npm run dev
```

## Verify It's Working

You should see in the logs:
```
✓ Loaded Firebase service account from: /path/to/file
✓ Firebase Admin SDK initialized successfully
✓ Firebase sync enabled - will check for new pairs every 60 seconds
```

## Without Firebase (Static Mode)

If you don't set up Firebase, the bot will still work with static pairs from `.env`:
```
⚠ Firebase service account not found - admin pair sync disabled
ℹ Firebase sync disabled - using static pairs from .env only
```

## Testing Dynamic Pair Addition


1. Start the bot
2. Go to admin panel in UI
3. Add a new pair (e.g., `ethereum:0xnewpairaddress`)
4. Within 60 seconds, bot logs should show:
   ```
   ℹ Starting monitoring for 1 new pairs
   ℹ   + ethereum:0xnewpairaddress (ETH/USDC)
   ℹ Pair sync complete: 20 pairs active
   ```
5. UI will show data for the new pair within 10-15 seconds

## Troubleshooting

**Bot not picking up new pairs?**
- Check bot logs for Firebase errors
- Verify `firebase-service-account.json` exists and is valid
- Ensure Firebase collection is named `admin-pairs`
- Check that bot has read permissions

**UI showing pairs but bot not writing data?**
- The bot only writes data for pairs it's monitoring
- Check DexScreener for valid data on those pairs
- Some chains/pairs may not be available on DexScreener
