/** Gera klines determinísticos no formato da API REST da Binance. */
export function makeRestKlines(
  count: number,
  {
    startMs = Date.UTC(2026, 9, 1),
    intervalMs = 60 * 60 * 1000,
    startPrice = 60_000,
    seed = 42,
  }: { startMs?: number; intervalMs?: number; startPrice?: number; seed?: number } = {},
): (string | number)[][] {
  let state = seed
  const rand = () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
  const rows: (string | number)[][] = []
  let price = startPrice
  for (let i = 0; i < count; i++) {
    const open = price
    const close = open * (1 + (rand() - 0.5) * 0.02)
    const high = Math.max(open, close) * (1 + rand() * 0.005)
    const low = Math.min(open, close) * (1 - rand() * 0.005)
    const volume = 100 + rand() * 900
    const openTime = startMs + i * intervalMs
    rows.push([
      openTime,
      open.toFixed(2),
      high.toFixed(2),
      low.toFixed(2),
      close.toFixed(2),
      volume.toFixed(5),
      openTime + intervalMs - 1,
      (volume * close).toFixed(2),
      1000,
      '0',
      '0',
      '0',
    ])
    price = close
  }
  return rows
}

export function makeKlineEvent(
  symbol: string,
  interval: string,
  c: { time: number; open: number; high: number; low: number; close: number; volume: number },
  isClosed = false,
) {
  return {
    e: 'kline',
    E: c.time * 1000 + 1,
    s: symbol,
    k: {
      t: c.time * 1000,
      T: c.time * 1000 + 59_999,
      s: symbol,
      i: interval,
      o: String(c.open),
      h: String(c.high),
      l: String(c.low),
      c: String(c.close),
      v: String(c.volume),
      x: isClosed,
    },
  }
}
