import type { Candle } from './types'

/**
 * Aplica uma atualização em tempo real à série (imutável):
 * mesmo horário substitui o último candle, horário novo é anexado,
 * horários antigos são substituídos no lugar (ou ignorados se não existirem).
 */
export function mergeCandle(candles: readonly Candle[], candle: Candle): Candle[] {
  const last = candles[candles.length - 1]
  if (!last || candle.time > last.time) return [...candles, candle]
  if (candle.time === last.time) return [...candles.slice(0, -1), candle]

  const index = candles.findIndex((c) => c.time === candle.time)
  if (index === -1) return candles as Candle[]
  const next = candles.slice()
  next[index] = candle
  return next
}

export function mergeCandles(candles: readonly Candle[], updates: readonly Candle[]): Candle[] {
  return updates.reduce<Candle[]>((acc, c) => mergeCandle(acc, c), candles as Candle[])
}

/** Casas decimais de preço a partir da magnitude (a Binance não envia tick size no kline). */
export function pricePrecision(price: number): number {
  const abs = Math.abs(price)
  if (abs >= 100) return 2
  if (abs >= 10) return 3
  if (abs >= 1) return 4
  if (abs >= 0.01) return 5
  if (abs >= 0.0001) return 6
  return 8
}
