/** Resposta de /api/v3/ticker/24hr no formato da Binance (campos usados e alguns extras). */
export function makeTicker24h(symbol: string, lastPrice: number, openPrice: number) {
  const change = lastPrice - openPrice
  return {
    symbol,
    priceChange: change.toFixed(8),
    priceChangePercent: ((change / openPrice) * 100).toFixed(3),
    lastPrice: lastPrice.toFixed(8),
    openPrice: openPrice.toFixed(8),
    highPrice: Math.max(lastPrice, openPrice).toFixed(8),
    lowPrice: Math.min(lastPrice, openPrice).toFixed(8),
    volume: '1000.00000000',
  }
}

/** Evento do stream <symbol>@miniTicker. */
export function makeMiniTicker(symbol: string, close: number, open: number) {
  return {
    e: '24hrMiniTicker',
    E: Date.now(),
    s: symbol,
    c: String(close),
    o: String(open),
    h: String(Math.max(close, open)),
    l: String(Math.min(close, open)),
    v: '1000',
    q: '1000000',
  }
}
