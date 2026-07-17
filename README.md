# EUR/USD Live Price Monitor

Get **real-time EUR/USD forex prices** from TradingView and receive alerts on Telegram.

Powered by the [@mathieuc/tradingview](https://github.com/Mathieu2301/TradingView-API) WebSocket library — no browser needed, lightweight and fast.

---

## How It Works

```
┌──────────────────────────┐
│  GitHub Actions (Wake)   │  <── Pings Render 5 min before each session
└────────────┬─────────────┘        (curl --max-time 60, waits through cold start)
             │ HTTP Ping
┌────────────▼─────────────┐
│  Render.com (Execution)  │  <── Runs `node index.js` for free
│  ┌─ Internal Keepalive ─┐│  <── Self-pings every 10 min during sessions
│  │   (prevents spin-down)││      to stay within Render (750h/mo)
│  └───────────────────────┘│
└────────────┬─────────────┘
             │ Live Price Stream
┌────────────▼─────────────┐
│  TradingView WebSocket    │  <── Real-time EUR/USD data feed
└────────────┬─────────────┘
             │ Telegram Alert (optional)
┌────────────▼─────────────┐
│     Telegram Phone       │  <── Receives price alerts
└──────────────────────────┘
```

## Features

- ✅ **Real-time prices** via TradingView WebSocket API
- ✅ **Trend Magic indicator** — ATR, CCI, MagicTrend level with bullish/bearish coloring
- ✅ **🚀 Buy Signal** — candle opens below MagicTrend, closes above (bullish cross)
- ✅ **🔻 Sell Signal** — candle opens above MagicTrend, closes below (bearish cross)
- ✅ **Telegram notifications** (optional — enable via `.env`)
- ✅ **GitHub Actions pre-wake** — wakes Render before each session (handles cold start where cron-job.org fails)
- ✅ **Session-gated internal keepalive** — self-pings during sessions to prevent spin-down

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

### Step 4: Enable Keepalive (GitHub Actions + Internal)

This project uses a **two-layer keepalive** strategy to survive Render's free tier spin-down:

#### Layer 1: GitHub Actions (Wake from Sleep)

GitHub Actions pings your Render URL **5 minutes before each session** with a 60-second timeout — long enough to handle Render's cold start (unlike cron-job.org's 30s limit).

1. **Add your Render URL as a GitHub secret:**
   - Go to your repo → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `RENDER_URL`
   - Value: `https://your-app-name.onrender.com/health`

2. **Adjust the cron schedule** (if your session times differ from defaults):
   - Edit `.github/workflows/keep-alive.yml`
   - Match the cron times to 5 minutes before each session start

3. **Test it:**
   - Go to your repo's **Actions** tab
   - Select **"Wake Render Before Sessions"**
   - Click **Run workflow** → **Run workflow**
   - Watch it ping your Render URL

#### Layer 2: Internal Self-Ping (Keep Alive During Sessions)

Once Render is awake, the built-in keepalive in `index.js` automatically pings itself every **10 minutes** during active session hours. This keeps Render from spinning down between candle closes.

Set your Render environment variable:
| Variable | Value |
|----------|-------|
| `RENDER_URL` | `https://your-app-name.onrender.com/health` |

> 💡 The internal keepalive is **session-gated** — it only runs during your configured trading sessions, saving Render's 750h/month free tier hours for when it matters.

### Step 5: Monitor

- View live logs in the Render dashboard
- Prices stream in real-time with Trend Magic indicator
- 🚀 **BUY** / 🔻 **SELL** cross signals in console
- Receive Telegram alerts (if configured)
- Visit `https://your-app.onrender.com/health` for status

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
| `RENDER_URL` | — | Your Render app URL (e.g. `https://ctc-alert.onrender.com`) — enables built-in 24/7 self-keepalive to prevent spin-down entirely |

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
