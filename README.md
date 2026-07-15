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

- ✅ **Real-time prices** via TradingView WebSocket API
- ✅ **Trend Magic indicator** — ATR, CCI, MagicTrend level with bullish/bearish coloring
- ✅ **🚀 Buy Signal** — candle opens below MagicTrend, closes above (bullish cross)
- ✅ **🔻 Sell Signal** — candle opens above MagicTrend, closes below (bearish cross)
- ✅ **Telegram notifications** (optional — enable via `.env`)
- ✅ **Built-in health server** — keeps Render free tier alive 24/7

---

## Quick Start (Local Testing)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/ctc-alert.git
cd ctc-alert

# 2. Install dependencies
npm install

# 3. Configure environment (optional — defaults work out of the box)
# Edit .env file or set env variables

# 4. Run it
npm start
```

You should see live prices streaming in your terminal within seconds.

---

## Deploy to Render.com (100% Free ✅)

Render's **Web Service** free tier works perfectly for this monitor. The built-in HTTP health server keeps the WebSocket connection alive so Render won't sleep your service.

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "CTC Alert: Trend Magic with cross signals"
git remote add origin https://github.com/YOUR_USERNAME/ctc-alert.git
git push -u origin master
```

### Step 2: Create Render Web Service

1. Go to **[render.com](https://render.com)** → Sign up (**no credit card required**)
2. Click **New +** → **Web Service**
3. Connect your GitHub account and select `ctc-alert`
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `ctc-alert` |
| **Region** | Choose closest to you |
| **Branch** | `master` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Plan** | **Free** ✅ |

### Step 3: Add Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SYMBOL` | `OANDA:EURUSD` | TradingView symbol to monitor |
| `TIMEFRAME` | `5` | Candle timeframe in minutes |
| `TM_AP` | `5` | ATR smoothing period |
| `TM_COEFF` | `1.0` | ATR multiplier |
| `TM_CCI_PERIOD` | `15` | CCI period |
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token (optional) |
| `TELEGRAM_CHAT_ID` | — | Telegram chat ID (optional) |

### Step 4: Monitor

- View live logs in the Render dashboard
- Prices stream in real-time with Trend Magic indicator
- 🚀 **BUY** / 🔻 **SELL** cross signals in console
- Receive Telegram alerts (if configured)
- Visit `https://your-app.onrender.com/health` for JSON status

---

## Telegram Setup (Optional)

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the instructions
3. Copy the **API token** you receive
4. Find your **Chat ID**:
   - Send a message to your bot
   - Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   - Copy the `chat.id` value
5. Add both values to your Render environment variables or `.env`

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SYMBOL` | `OANDA:EURUSD` | TradingView symbol to monitor |
| `TIMEFRAME` | `5` | Candle timeframe in minutes |
| `TM_AP` | `5` | ATR smoothing period (Trend Magic) |
| `TM_COEFF` | `1.0` | ATR multiplier (Trend Magic) |
| `TM_CCI_PERIOD` | `15` | CCI period (Trend Magic) |
| `TM_HISTORY_RANGE` | `10000` | Historical candles for warmup |
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token (optional) |
| `TELEGRAM_CHAT_ID` | — | Telegram chat ID (optional) |
| `RENDER_URL` | — | Your Render app URL (e.g. `https://ctc-alert.onrender.com`) — enables built-in self-keepalive during sessions Mon-Fri |

---

## TradingView Symbol Formats

| Pair | Symbol |
|------|--------|
| EUR/USD | `OANDA:EURUSD` |
| GBP/USD | `OANDA:GBPUSD` |
| USD/JPY | `OANDA:USDJPY` |
| BTC/USD | `BINANCE:BTCUSDT` |
| Gold | `TVC:GOLD` |
| S&P 500 | `TVC:SPX` |

---

## License

MIT
