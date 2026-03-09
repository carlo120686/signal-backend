export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).end()
  }
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')

  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`
    const res2 = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    })
    if (!res2.ok) throw new Error(`Yahoo HTTP ${res2.status}`)
    const data = await res2.json()
    const result = data?.chart?.result?.[0]
    if (!result) throw new Error('No data')

    const meta = result.meta
    const closes = result.indicators.quote[0].close.filter(Boolean)
    const current = meta.regularMarketPrice
    const prev = meta.chartPreviousClose
    const change = ((current - prev) / prev) * 100
    const sma20 = closes.length >= 20 ? avg(closes.slice(-20)) : null
    const sma50 = closes.length >= 50 ? avg(closes.slice(-50)) : null

    return res.status(200).json({
      symbol, ok: true, current, change, sma20, sma50,
      rsi: calcRSI(closes), macd: calcMACD(closes), bb: calcBB(closes),
      trendUp: sma20 ? current > sma20 : null,
      goldenCross: sma20 && sma50 ? sma20 > sma50 : null,
      sparkline: closes.slice(-30).map((v, i) => ({ i, v })),
      high52: meta.fiftyTwoWeekHigh, low52: meta.fiftyTwoWeekLow,
      currency: meta.currency, name: meta.longName || symbol,
    })
  } catch (e) {
    return res.status(500).json({ ok: false, symbol, error: e.message })
  }
}

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length }
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses += Math.abs(d)
  }
  return 100 - 100 / (1 + gains / (losses || 0.001))
}
function calcMACD(closes) {
  if (closes.length < 26) return null
  const macdLine = calcEMA(closes, 12) - calcEMA(closes, 26)
  return { macdLine, signal: macdLine > 0 ? 'bullish' : 'bearish' }
}
function calcEMA(closes, period) {
  const k = 2 / (period + 1)
  let ema = avg(closes.slice(0, period))
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k)
  return ema
}
function calcBB(closes, period = 20) {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const mean = avg(slice)
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period)
  const upper = mean + 2 * std; const lower = mean - 2 * std
  return { upper, lower, mean, pct: Math.round(((closes[closes.length-1] - lower) / (upper - lower)) * 100) }
}
