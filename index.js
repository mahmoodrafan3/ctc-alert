require('dotenv').config();
const { Client } = require('@mathieuc/tradingview');

// ============================================================
// CONFIGURATION - Edit these or set via .env file
// ============================================================

const SYMBOL = process.env.SYMBOL || 'OANDA:EURUSD'; // Matches TradingView chart prices
const TIMEFRAME = process.env.TIMEFRAME || '5'; // 5-minute candles

// Derive a readable pair name from the symbol
function getPairName(symbol) {
  const parts = symbol.split(':');
  const base = parts[1] || parts[0];
  if (base.length >= 6) {
    const cryptoQuote = base.slice(-4);
    if (['USDT', 'USDC', 'BUSD', 'DAI'].includes(cryptoQuote)) return base.slice(0, -4) + '/' + cryptoQuote;
    const fxQuote = base.slice(-3);
    if (['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'].includes(fxQuote)) return base.slice(0, -3) + '/' + fxQuote;
  }
  return base;
}
const PAIR_NAME = getPairName(SYMBOL);

// Telegram (optional - set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || null;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;

// ============================================================
// SESSION CONFIG - Only process candles during these times (UTC)
// ============================================================

// London: 03:00-05:00 EST = 08:00-10:00 UTC
// New York: 08:00-10:00 EST = 13:00-15:00 UTC
const SESSION_ENABLED = process.env.SESSION_ENABLED !== 'false'; // Toggle sessions on/off
const SESSIONS = [
  { name: 'London', start: 8, end: 10 },
  { name: 'New York', start: 13, end: 15 },
];

let wasInSession = false; // Track session transitions for logging

// ============================================================
// DISPLAY TOGGLES - Control what gets shown/sent
// ============================================================

const SHOW_CANDLE_DETAILS = process.env.SHOW_CANDLE_DETAILS !== 'false'; // Show candle close in console
const SEND_TELEGRAM_CANDLE = process.env.SEND_TELEGRAM_CANDLE !== 'false'; // Send candle details to Telegram

// ============================================================
// ANSI COLOR SYSTEM 🎨
// ============================================================

const Color = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m',
  bgBrightRed: '\x1b[101m',
  bgBrightGreen: '\x1b[102m',
  bgBrightYellow: '\x1b[103m',
  bgBrightBlue: '\x1b[104m',
};

// Helper: wrap text in color
function colorText(text, colorCode) {
  return `${colorCode}${text}${Color.reset}`;
}

// Shortcut color helpers
const green = (t) => colorText(t, Color.green);
const red = (t) => colorText(t, Color.red);
const yellow = (t) => colorText(t, Color.yellow);
const cyan = (t) => colorText(t, Color.cyan);
const magenta = (t) => colorText(t, Color.magenta);
const blue = (t) => colorText(t, Color.blue);
const gray = (t) => colorText(t, Color.gray);
const white = (t) => colorText(t, Color.white);
const bold = (t) => colorText(t, Color.bold);
const brightGreen = (t) => colorText(t, Color.brightGreen);
const brightRed = (t) => colorText(t, Color.brightRed);
const brightYellow = (t) => colorText(t, Color.brightYellow);

// ============================================================
// TELEGRAM HELPER (optional)
// Requires Node 18+ (global fetch)
// ============================================================

async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      console.error('  Telegram API error:', response.status, errText);
    }
  } catch (err) {
    console.error('  Telegram send failed:', err.message);
  }
}

// ============================================================
// PRICE FORMATTING
// ============================================================

function formatPrice(price) {
  const num = Number(price);
  if (num >= 1000) return num.toFixed(2);
  if (num >= 100) return num.toFixed(3);
  if (num >= 1) return num.toFixed(5);
  return num.toFixed(6);
}

function getTimestamp() {
  return new Date().toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC';
}

function formatCandleTime(time) {
  const d = new Date(time * 1000);
  return d.toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC';
}

// ============================================================
// SESSION UTILITIES
// ============================================================

function getUTCHour(time) {
  return new Date(time * 1000).getUTCHours();
}

function getCurrentSession(utcHour) {
  for (const s of SESSIONS) {
    // Session is [start, end) — end is exclusive
    if (utcHour >= s.start && utcHour < s.end) return s;
  }
  return null;
}

function getSessionName(utcHour) {
  const s = getCurrentSession(utcHour);
  return s ? s.name : null;
}

// ============================================================
// TREND MAGIC INDICATOR — from Pine Script
//
// ATR   = ta.sma(ta.tr, AP)
// upT   = low - ATR * coeff
// downT = high + ATR * coeff
// MagicTrend → trailing level: rising floor (CCI≥0) / falling ceiling (CCI<0)
// Color: blue (CCI≥0) / red (CCI<0)
// ============================================================

// ============================================================
// TREND MAGIC INDICATOR — exact match to your Pine Script
// ============================================================

const TM_AP = Number(process.env.TM_AP) || 5;            // ATR smoothing period (must match Pine)
const TM_COEFF = Number(process.env.TM_COEFF) || 1.0;     // ATR multiplier (must match Pine)
const TM_CCI_PERIOD = Number(process.env.TM_CCI_PERIOD) || 15; // CCI period
const TM_CCI_SRC = (process.env.TM_CCI_SRC || 'close').toLowerCase(); // CCI price source
const TM_HISTORY_RANGE = Number(process.env.TM_HISTORY_RANGE) || 10000; // Historical candles
const TM_MAX_HISTORY = Math.max(TM_AP + 2, TM_CCI_PERIOD) + 5; // Candle buffer

// Candle history — stores { open, high, low, close } of closed candles
const candleHistory = [];

// Persistent MagicTrend — never reset after warmup (like Pine Script var)
let prevMagicTrend = null;

// -------- ATR: ta.sma(ta.tr, TM_AP) --------
function computeATR() {
  if (candleHistory.length < TM_AP + 1) return null;

  const tr = [];
  for (let i = candleHistory.length - TM_AP; i < candleHistory.length; i++) {
    const c = candleHistory[i];
    const prev = candleHistory[i - 1];
    tr.push(Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    ));
  }
  return tr.reduce((a, b) => a + b, 0) / TM_AP;
}

// -------- CCI: Commodity Channel Index --------
function computeCCI() {
  if (candleHistory.length < TM_CCI_PERIOD) return null;

  const values = [];
  for (let i = candleHistory.length - TM_CCI_PERIOD; i < candleHistory.length; i++) {
    values.push(candleHistory[i].close);
  }

  const sma = values.reduce((a, b) => a + b, 0) / TM_CCI_PERIOD;
  let md = 0;
  for (const v of values) md += Math.abs(v - sma);
  md /= TM_CCI_PERIOD;

  if (md === 0) return 0;
  return (values[values.length - 1] - sma) / (0.015 * md);
}

// -------- MagicTrend (exact Pine Script logic) --------
//   No 0 values anywhere — just upT/downT directly
function computeMagicTrend(candle) {
  const atr = computeATR();
  const cci = computeCCI();

  if (atr === null || cci === null) return null;

  const upT = candle.low - atr * TM_COEFF;
  const downT = candle.high + atr * TM_COEFF;

  if (prevMagicTrend === null) {
    prevMagicTrend = cci >= 0 ? upT : downT;
  } else {
    if (cci >= 0) {
      prevMagicTrend = upT < prevMagicTrend ? prevMagicTrend : upT;
    } else {
      prevMagicTrend = downT > prevMagicTrend ? prevMagicTrend : downT;
    }
  }
  return prevMagicTrend;
}

// -------- Compute all Trend Magic values for display --------
function computeTrendMagic(candle) {
  const magicTrend = computeMagicTrend(candle);
  const atr = computeATR();
  const cci = computeCCI();
  const isBlue = cci !== null && cci >= 0;

  return {
    magicTrend,
    atr,
    cci,
    upT: atr !== null ? candle.low - atr * TM_COEFF : null,
    downT: atr !== null ? candle.high + atr * TM_COEFF : null,
    isBlue,
    isRed: cci !== null && cci < 0,
    label: cci !== null ? (cci >= 0 ? 'BULLISH' : 'BEARISH') : 'WARMUP',
    emoji: cci !== null ? (cci >= 0 ? '📈' : '📉') : '⏳',
  };
}

// -------- Warmup: process every candle oldest→newest (recursive state!) --------
function warmupFromHistory(periods) {
  const closedCandles = [];
  for (let i = periods.length - 1; i >= 1; i--) {
    closedCandles.push({
      open: periods[i].open,
      high: periods[i].max,
      low: periods[i].min,
      close: periods[i].close,
    });
  }

  for (const c of closedCandles) {
    candleHistory.push(c);
    if (candleHistory.length > TM_MAX_HISTORY) candleHistory.shift();
    computeMagicTrend(c); // advances prevMagicTrend, never reset
  }

  console.log(cyan(`   🔄 Pre-warmed from ${closedCandles.length} candles`));
}

function magicTrendColorLabel(isBlue) {
  return isBlue ? blue('●') : red('●');
}

// ============================================================
// MAIN
// ============================================================

const padding = ' '.repeat(Math.max(0, 24 - PAIR_NAME.length));
console.log('');
console.log(blue('╔══════════════════════════════════════════════╗'));
console.log(blue('║  ') + brightYellow(`${PAIR_NAME} Live Price Monitor`) + gray(`${padding}`) + blue('║'));
console.log(blue('║  ') + cyan('  Powered by TradingView Chart API       ') + blue(' ║'));
console.log(blue('╚══════════════════════════════════════════════╝'));
console.log(gray(`   Symbol: `) + white(SYMBOL));
console.log(gray(`   Started: `) + white(getTimestamp()));
console.log(gray(`   Timeframe:  `) + white(`${TIMEFRAME} minute(s) (OHLC from TradingView chart)`));
if (TELEGRAM_BOT_TOKEN) console.log(gray('   Telegram: ') + brightGreen('✅ Enabled'));
else console.log(gray('   Telegram: ') + gray('❌ Disabled (set TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID)'));

// Display toggles
console.log(gray('   ─── Display Toggles ───'));
console.log(gray('   Console candles: ') + (SHOW_CANDLE_DETAILS ? green('🖥️ ON') : gray('❌ OFF')) + gray('  |  Telegram candles: ') + (SEND_TELEGRAM_CANDLE ? brightGreen('📨 ON') : gray('❌ OFF')));
console.log(gray('   Signals (BUY/SELL) always show in both console & Telegram regardless'));
console.log(gray('   ─── Trend Magic ───'));
console.log(gray('   ATR period: ') + white(String(TM_AP)) + gray(' | CCI period: ') + white(String(TM_CCI_PERIOD)) + gray(' | Coeff: ') + white(String(TM_COEFF)));
console.log(gray('   CCI src: ') + white(TM_CCI_SRC.toUpperCase()) + gray(' | Coloring: ') + blue('CCI≥0=Blue') + gray(' / ') + red('CCI<0=Red'));

// Sessions info
if (SESSION_ENABLED) {
  console.log(gray('   ─── Sessions ───'));
  console.log(gray('   ') + yellow('🕐 London 08-10 UTC') + gray(' | ') + yellow('🗽 New York 13-15 UTC'));
  const nowUTC = new Date().getUTCHours();
  const activeSession = getCurrentSession(nowUTC);
  if (activeSession) {
    console.log(`     ${green('●')} ${white(activeSession.name)} ${green('session is ACTIVE now')}`);
  } else {
    console.log(`     ${gray('●')} ${gray('Outside trading hours — bot is idle')}`);
  }
}
console.log('');

// ------------------------------------------------------------------
// Connect to TradingView Chart Session
// ------------------------------------------------------------------

const client = new Client();
const chart = new client.Session.Chart();

// State
let lastCandleTime = null;
let candleCount = 0;

// Web server status (for Render health check)
let latestStatus = {
  status: 'starting',
  symbol: SYMBOL,
  pair: PAIR_NAME,
  timeframe: TIMEFRAME,
  sessions: 'London 08-10 UTC | New York 13-15 UTC',
  currentSession: null,
  inSession: false,
  uptime: null,
  lastCandle: null,
  lastSignal: null,
  candleCount: 0,
};

// ============================================================
// CANDLE CLOSE HANDLER
// ============================================================

function onCandleClosed(closedCandle) {
  candleCount++;

  // Update web status
  latestStatus.candleCount = candleCount;
  latestStatus.lastCandle = {
    time: formatCandleTime(closedCandle.time),
    open: formatPrice(closedCandle.open),
    close: formatPrice(closedCandle.close),
    high: formatPrice(closedCandle.max),
    low: formatPrice(closedCandle.min),
  };

  const move = closedCandle.close - closedCandle.open;
  const moveSign = move >= 0 ? '+' : '';
  const range = closedCandle.max - closedCandle.min;

  // Store candle in history for indicator calculation
  candleHistory.push({
    open: closedCandle.open,
    high: closedCandle.max,
    low: closedCandle.min,
    close: closedCandle.close,
    time: closedCandle.time,
    volume: closedCandle.volume,
  });
  if (candleHistory.length > TM_MAX_HISTORY) {
    candleHistory.shift();
  }

  // ---- TREND MAGIC INDICATOR ----
  // Normalize TradingView candle (max/min → high/low) before passing to indicator
  const normCandle = {
    high: closedCandle.max,
    low: closedCandle.min,
    close: closedCandle.close,
    open: closedCandle.open,
  };
  const tm = computeTrendMagic(normCandle);
  const cciStr = tm.cci !== null ? tm.cci.toFixed(1) : '--';
  const atrStr = tm.atr !== null ? formatPrice(tm.atr) : '--';
  const mtStr = tm.magicTrend !== null ? formatPrice(tm.magicTrend) : '--';

  // Distance from close to MagicTrend
  const distToMT = tm.magicTrend !== null
    ? closedCandle.close - tm.magicTrend
    : null;
  const distStr = distToMT !== null
    ? `${distToMT >= 0 ? '+' : ''}${formatPrice(distToMT)}`
    : '--';
  const priceAboveMT = distToMT !== null && distToMT >= 0;

  // Cross detection (used regardless of session)
  const isBullishCross = tm.magicTrend !== null &&
    closedCandle.open < tm.magicTrend &&
    closedCandle.close > tm.magicTrend;

  const isBearishCross = tm.magicTrend !== null &&
    closedCandle.open > tm.magicTrend &&
    closedCandle.close < tm.magicTrend;

  // Track latest signal for web status (always update)
  if (isBullishCross) {
    latestStatus.lastSignal = {
      type: 'BUY 🚀',
      time: formatCandleTime(closedCandle.time),
      open: formatPrice(closedCandle.open),
      close: formatPrice(closedCandle.close),
      mt: mtStr,
    };
  }
  if (isBearishCross) {
    latestStatus.lastSignal = {
      type: 'SELL 🔻',
      time: formatCandleTime(closedCandle.time),
      open: formatPrice(closedCandle.open),
      close: formatPrice(closedCandle.close),
      mt: mtStr,
    };
  }

  // ---- SESSION CHECK: Skip display/alerts outside trading hours ----
  if (SESSION_ENABLED) {
    const utcHour = getUTCHour(closedCandle.time);
    const activeSession = getCurrentSession(utcHour);
    if (!activeSession) return; // Skip display & alerts outside sessions
  }

  // ---- TREND MAGIC DISPLAY DATA (needed by both console + Telegram) ----
  const upTStr = tm.upT !== null ? formatPrice(tm.upT) : '--';
  const downTStr = tm.downT !== null ? formatPrice(tm.downT) : '--';

  // ---- DISPLAY CANDLE CLOSE (toggle via SHOW_CANDLE_DETAILS) ----
  if (SHOW_CANDLE_DETAILS) {
    console.log('');
    console.log(blue('═').repeat(60));
    console.log(`   📊 ${bold(PAIR_NAME)} ${gray(`${TIMEFRAME}M CANDLE`)} #${bold(String(candleCount))} ${cyan('CLOSED')}`);
    console.log(gray(`   ${formatCandleTime(closedCandle.time)}`));
    console.log(gray(`   ──────────────────────────────────────────────────────────`));
    console.log(`     ${gray('Open:')}  ${white(formatPrice(closedCandle.open))}`);
    console.log(`     ${gray('Close:')}  ${bold(tm.isBlue ? blue(formatPrice(closedCandle.close)) : red(formatPrice(closedCandle.close)))}  ${tm.isBlue ? blue('🟦 BULLISH') : red('🟥 BEARISH')}`);
    console.log(`     ${gray('Move:')}  ${moveSign}${formatPrice(move)}`);
    console.log(`     ${gray('High:')}  ${white(formatPrice(closedCandle.max))}  ${gray('Low:')} ${white(formatPrice(closedCandle.min))}`);
    console.log(`     ${gray('Range:')}  ${white(formatPrice(range))}  ${gray('Vol:')} ${white(Math.round(closedCandle.volume))}`);

    // ---- TREND MAGIC DISPLAY (faithful to Pine Script) ----
    console.log(gray(`   ──────────────────────────────────────────────────────────`));
    // ── Line 1: Title with colored dot ──
    const dotColor = tm.isBlue ? blue : red;
    console.log(`     ${dotColor('✦')} ${bold('TREND MAGIC')} ${dotColor('✦')}`);
    // ── Line 2: MagicTrend level + CCI + ATR ──
    const mtLevelColored = tm.isBlue ? blue(mtStr) : red(mtStr);
    const cciColored = tm.cci !== null
      ? (tm.cci >= 100 ? brightGreen(tm.cci.toFixed(1)) : tm.cci <= -100 ? brightRed(tm.cci.toFixed(1)) : yellow(tm.cci.toFixed(1)))
      : gray('--');
    console.log(`     ${gray('MagicTrend:')}  ${bold(mtLevelColored)}  ${magicTrendColorLabel(tm.isBlue)}  ${gray('CCI:')} ${cciColored}  ${gray('ATR:')} ${white(atrStr)}`);
    // ── Line 3: upT / downT bands + price position ──
    console.log(`     ${gray(' upT:')}  ${blue(upTStr)}  ${gray('dnT:')}  ${red(downTStr)}  ${gray('Dist:')} ${priceAboveMT ? green(distStr) : red(distStr)}`);
    console.log(blue('═').repeat(60));
    console.log('');
  }

  // ---- CROSS DETECTION DISPLAY (always shown) ----
  if (isBullishCross) {
    console.log(`     ${brightGreen('▰'.repeat(52))}`);
    console.log(`     ${brightGreen('▰')}  ${bold(brightGreen('🚀 BULLISH CROSS CONFIRMED! BUY SIGNAL'))}  ${brightGreen('▰')}`);
    console.log(`     ${brightGreen('▰')}  ${gray('Open:')} ${white(formatPrice(closedCandle.open))} ${gray('< MT:')} ${bold(mtStr)} ${gray('< Close:')} ${white(formatPrice(closedCandle.close))}  ${brightGreen('▰')}`);
    console.log(`     ${brightGreen('▰')}  ${gray('Price broke ABOVE the Trend Magic level!')}  ${brightGreen('▰')}`);
    console.log(`     ${brightGreen('▰'.repeat(52))}`);
  }

  if (isBearishCross) {
    console.log(`     ${brightRed('▰'.repeat(52))}`);
    console.log(`     ${brightRed('▰')}  ${bold(brightRed('🔻 BEARISH CROSS CONFIRMED! SELL SIGNAL'))}  ${brightRed('▰')}`);
    console.log(`     ${brightRed('▰')}  ${gray('Open:')} ${white(formatPrice(closedCandle.open))} ${gray('> MT:')} ${bold(mtStr)} ${gray('> Close:')} ${white(formatPrice(closedCandle.close))}  ${brightRed('▰')}`);
    console.log(`     ${brightRed('▰')}  ${gray('Price broke BELOW the Trend Magic level!')}  ${brightRed('▰')}`);
    console.log(`     ${brightRed('▰'.repeat(52))}`);
  }

  // ---- TELEGRAM (plain text, no ANSI codes) ----
  if (TELEGRAM_BOT_TOKEN) {
    // ---- TELEGRAM CANDLE CLOSE (toggle via SEND_TELEGRAM_CANDLE) ----
    if (SEND_TELEGRAM_CANDLE) {
      let tgMsg = `<b>🕯️ ${PAIR_NAME} ${TIMEFRAME}M Candle #${candleCount} Closed</b>\n`;
      tgMsg += `<code>${formatCandleTime(closedCandle.time)}</code>\n`;
      tgMsg += `Open: ${formatPrice(closedCandle.open)} | Close: ${formatPrice(closedCandle.close)}\n`;
      tgMsg += `High: ${formatPrice(closedCandle.max)} | Low: ${formatPrice(closedCandle.min)}\n`;
      tgMsg += `Move: ${moveSign}${formatPrice(move)} | Range: ${formatPrice(range)}\n`;
      tgMsg += `Direction: ${tm.isBlue ? '🟦 Bullish' : '🟥 Bearish'}\n`;
      tgMsg += `\n${tm.emoji} <b>TREND MAGIC</b>\n`;
      tgMsg += `Level: ${mtStr} | CCI: ${cciStr} | ATR: ${atrStr}\n`;
      tgMsg += `upT: ${upTStr} | dnT: ${downTStr} | Dist: ${distStr}`;

      sendTelegramAlert(tgMsg);
    }

    // ---- TELEGRAM CROSS SIGNALS (always sent) ----
    if (isBullishCross) {
      let crossMsg = `<b>🚀 ${PAIR_NAME} BULLISH CROSS CONFIRMED!</b>\n`;
      crossMsg += `<code>Buy Signal — ${formatCandleTime(closedCandle.time)}</code>\n`;
      crossMsg += `Candle opened below MagicTrend and closed above!\n`;
      crossMsg += `Open: ${formatPrice(closedCandle.open)} | Close: ${formatPrice(closedCandle.close)}\n`;
      crossMsg += `MagicTrend Level: ${mtStr}\n`;
      crossMsg += `CCI: ${cciStr} | ATR: ${atrStr}`;

      sendTelegramAlert(crossMsg);
    }

    // ---- TELEGRAM BEARISH CROSS ALERT ----
    if (isBearishCross) {
      let crossMsg = `<b>🔻 ${PAIR_NAME} BEARISH CROSS CONFIRMED!</b>\n`;
      crossMsg += `<code>Sell Signal — ${formatCandleTime(closedCandle.time)}</code>\n`;
      crossMsg += `Candle opened above MagicTrend and closed below!\n`;
      crossMsg += `Open: ${formatPrice(closedCandle.open)} | Close: ${formatPrice(closedCandle.close)}\n`;
      crossMsg += `MagicTrend Level: ${mtStr}\n`;
      crossMsg += `CCI: ${cciStr} | ATR: ${atrStr}`;

      sendTelegramAlert(crossMsg);
    }
  }
}

// ============================================================
// CHART EVENTS
// ============================================================

chart.onError((...err) => {
  console.error('❌ Chart error:', ...err);
});

chart.onSymbolLoaded(() => {
  console.log(cyan(`📡 Market "${chart.infos.description}" loaded!`));
  console.log(gray(`   Source: ${chart.infos.full_name}`));
  console.log(gray(`   Currency: ${chart.infos.currency_id || 'N/A'}`));
  console.log(gray(`   Exchange: ${chart.infos.exchange || 'N/A'}`));
  console.log('');
});

chart.onUpdate(() => {
  if (!chart.periods || chart.periods.length === 0) return;

  const currentCandle = chart.periods[0];

  // On first live update: warm up indicators + initialize
  if (lastCandleTime === null) {
    // Pre-warm from historical periods for ATR, CCI, MagicTrend
    warmupFromHistory(chart.periods);

    lastCandleTime = currentCandle.time;
    console.log(`${brightYellow('💰')} ${bold(PAIR_NAME)}: ${bold(formatPrice(currentCandle.close))} ${gray('|')} ${formatCandleTime(currentCandle.time)}`);
    console.log(`🕯️ ${gray('Monitoring')} ${TIMEFRAME}M ${gray('candles — waiting for close...')}`);
    console.log('');
    return;
  }

  // ---- SESSION TRANSITION LOGGING ----
  if (SESSION_ENABLED) {
    const nowHour = getUTCHour(currentCandle.time);
    const nowSession = getCurrentSession(nowHour);
    const isNowInSession = nowSession !== null;

    // Update health status
    latestStatus.currentSession = isNowInSession ? nowSession.name : null;
    latestStatus.inSession = isNowInSession;

    if (isNowInSession && !wasInSession) {
      console.log(`\n   ${brightGreen('🟢')} ${bold(brightGreen(`${nowSession.name} Session STARTED`))} ${gray(`(${nowSession.start}:00-${nowSession.end}:00 UTC)`)}`);
      console.log('');
    } else if (!isNowInSession && wasInSession) {
      const prevSession = getSessionName(getUTCHour(lastCandleTime));
      console.log(`\n   ${brightRed('🔴')} ${bold(brightRed(`${prevSession || 'Trading'} Session ENDED`))} ${gray(`— bot idle until next session`)}`);
      console.log('');
    }
    wasInSession = isNowInSession;
  }

  // Detect candle close: time changed → a new candle started
  if (currentCandle.time !== lastCandleTime) {
    // The closed candle should be at index 1
    const closedCandle = chart.periods[1];
    if (closedCandle) {
      onCandleClosed(closedCandle);
    }
  }

  lastCandleTime = currentCandle.time;
});

// Start streaming — use large range for MagicTrend convergence
chart.setMarket(SYMBOL, {
  timeframe: TIMEFRAME,
  range: TM_HISTORY_RANGE, // Need lots of history for MagicTrend to converge
});

// ============================================================
// WEB SERVER (for Render.com Web Service health check)
// Render requires a listening port for Web Services (free tier)
// ============================================================

const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(latestStatus, null, 2));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

server.on('error', (err) => {
  console.error(`   🌐 Health server error: ${err.message}`);
});

server.listen(PORT, () => {
  latestStatus.status = 'running';
  latestStatus.uptime = getTimestamp();
  console.log(cyan(`   🌐 Health server active on port ${PORT} (Render Web Service)`));
  console.log('');
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown() {
  console.log(`\n\n👋 ${cyan(`Shutting down ${PAIR_NAME} monitor...`)}`);
  server.close();
  client.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
