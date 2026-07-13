# EUR/USD Live Price Monitor

Get **real-time EUR/USD forex prices** from TradingView and receive alerts on Telegram.

Powered by the [@mathieuc/tradingview](https://github.com/Mathieu2301/TradingView-API) WebSocket library — no browser needed, lightweight and fast.

---

## How It Works

```
┌─────────────────────────┐
│    GitHub (Storage)     │  <── Holds your code
└────────────┬────────────┘
             │ Automatic Sync
┌────────────▼────────────┐
│  Render.com (Execution) │  <── Runs `node index.js` 24/5 for free
└────────────┬────────────┘
             │ Live Price Stream
┌────────────▼────────────┐
│  TradingView WebSocket   │  <── Real-time EUR/USD data feed
└────────────┬────────────┘
             │ Telegram Alert (optional)
┌────────────▼────────────┐
│     Telegram Phone      │  <── Receives price alerts
└─────────────────────────┘
```

## Features

- ✅ **Real-time EUR/USD prices** via TradingView WebSocket API
- ✅ **No browser required** — lightweight, minimal resource usage
- ✅ **5-minute summary reports** with high/low/change stats
- ✅ **Price movement alerts** configurable threshold (default: 10 pips)
- ✅ **Telegram notifications** (optional — enable via `.env`)
- ✅ **Runs continuously** — perfect for Render.com 24/5 free tier

---

## Quick Start (Local Testing)

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd ctc-alert

# 2. Install dependencies
npm install

# 3. Copy and configure environment
cp .env.example .env

# 4. Run it
npm start
```

You should see live EUR/USD prices streaming in your terminal within seconds.

---

## Deploy to Render.com (100% Free)

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: EUR/USD live price monitor"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Create Render Background Worker

1. Go to **[render.com](https://render.com)** and sign up (no credit card required)
2. Click **New +** → **Background Worker**
3. Connect your GitHub account and select your repository
4. Configure:
   - **Name:** `eurusd-price-monitor` (or whatever you like)
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Plan:** Free
5. Add environment variables (optional):
   - `SYMBOL` — default: `FX:EURUSD`
   - `SUMMARY_INTERVAL` — default: `300000` (5 min)
   - `PRICE_THRESHOLD` — default: `0.0010` (10 pips)
   - `TELEGRAM_BOT_TOKEN` — your Telegram bot token
   - `TELEGRAM_CHAT_ID` — your Telegram chat ID
6. Click **Create Background Worker**

Render will pull your code, install dependencies, and start the worker immediately.

### Step 3: Monitor

Once deployed, you can:
- View live logs in the Render dashboard
- Prices stream in real-time to the console
- Receive Telegram alerts when significant moves occur

---

## Telegram Setup (Optional)

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the instructions
3. Copy the **API token** you receive
4. Find your **Chat ID**:
   - Send a message to your bot
   - Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   - Copy the `chat.id` value
5. Add both values to your `.env` file or Render environment variables

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SYMBOL` | `FX:EURUSD` | TradingView symbol to monitor |
| `SUMMARY_INTERVAL` | `300000` | Summary report interval (ms) |
| `PRICE_THRESHOLD` | `0.0010` | Price change alert threshold (10 pips) |
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token (optional) |
| `TELEGRAM_CHAT_ID` | — | Telegram chat ID (optional) |

---

## TradingView Symbol Formats

| Pair | Symbol |
|------|--------|
| EUR/USD | `FX:EURUSD` |
| GBP/USD | `FX:GBPUSD` |
| USD/JPY | `FX:USDJPY` |
| BTC/USD | `BINANCE:BTCUSDT` |
| Gold | `TVC:GOLD` |
| S&P 500 | `TVC:SPX` |

---

## License

MIT
