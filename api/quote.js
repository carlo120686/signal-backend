import yahooFinance from 'yahoo-finance2'

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(200).end()
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')

  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  try {
    const [quote, historical] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.historical(symbol, {
        period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period2: new Date().toISOString().split('T')[0],
        interval: '1d',
      })
    ])

    const closes = historical.map(d => d.close).filter(Boolean)

    const sma20 = closes.length >= 20 ? avg(closes.slice(-20)) : null
    const sma50 = closes.length >= 50 ? avg(closes.slice(-50)) : null
    const rsi   = calcRSI(closes, 14)
    const macd  = calcMACD(closes)
    const current = quote.regularMarketPrice
    const trendUp = sma20 ? current > sma20 : null
    const goldenCross = sma20 && sma50 ? sma20 > sma50 : null
    const change = quote.regularMarketChangePercent

    // Bollinger Bands
    const bb = calcBB(closes, 20)

    // Sparkline (ultimi 30 giorni)
    const sparkline = closes.slice(-30).map((v, i) => ({ i, v }))

    return res.status(200).json({
      symbol,
      current,
      change,
      sma20,
      sma50,
      rsi,
      macd,
      bb,
      trendUp,
      goldenCross,
      sparkline,
      high52: quote.fiftyTwoWeekHigh,
      low52:  quote.fiftyTwoWeekLow,
      currency: quote.currency,
      volume: quote.regularMarketVolume,
      marketCap: quote.marketCap,
      name: quote.longName || quote.shortName,
      ok: true,
    })
  } catch (e) {
    return res.status(500).json({ ok: false, symbol, error: e.message })
  }
}

// ── Batch endpoint per caricare più simboli in una volta ──
export async function batchHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols required' })
  const list = symbols.split(',').slice(0, 20) // max 20 alla volta
  const results = await Promise.allSettled(list.map(s => fetchOne(s)))
  const data = {}
  results.forEach((r, i) => {
    data[list[i]] = r.status === 'fulfilled' ? r.value : { ok: false, symbol: list[i] }
  })
  return res.status(200).json(data)
}

async function fetchOne(symbol) {
  const [quote, historical] = await Promise.all([
    yahooFinance.quote(symbol),
    yahooFinance.historical(symbol, {
      period1: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      period2: new Date().toISOString().split('T')[0],
      interval: '1d',
    })
  ])
  const closes = historical.map(d => d.close).filter(Boolean)
  const sma20 = closes.length >= 20 ? avg(closes.slice(-20)) : null
  const sma50 = closes.length >= 50 ? avg(closes.slice(-50)) : null
  const current = quote.regularMarketPrice
  return {
    symbol,
    current,
    change: quote.regularMarketChangePercent,
    sma20, sma50,
    rsi: calcRSI(closes, 14),
    macd: calcMACD(closes),
    bb: calcBB(closes, 20),
    trendUp: sma20 ? current > sma20 : null,
    goldenCross: sma20 && sma50 ? sma20 > sma50 : null,
    sparkline: closes.slice(-30).map((v, i) => ({ i, v })),
    high52: quote.fiftyTwoWeekHigh,
    low52: quote.fiftyTwoWeekLow,
    currency: quote.currency,
    name: quote.longName || quote.shortName,
    ok: true,
  }
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  const rs = gains / (losses || 0.001)
  return 100 - 100 / (1 + rs)
}

function calcMACD(closes) {
  if (closes.length < 26) return null
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macdLine = ema12 - ema26
  return { macdLine, signal: macdLine > 0 ? 'bullish' : 'bearish' }
}

function calcEMA(closes, period) {
  const k = 2 / (period + 1)
  let ema = avg(closes.slice(0, period))
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }
  return ema
}

function calcBB(closes, period = 20) {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const mean = avg(slice)
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period)
  const upper = mean + 2 * std
  const lower = mean - 2 * std
  const current = closes[closes.length - 1]
  const pct = ((current - lower) / (upper - lower)) * 100
  return { upper, lower, mean, pct: Math.round(pct) }
}
