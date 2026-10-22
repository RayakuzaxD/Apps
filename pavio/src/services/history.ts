import { aggregateCandles, monthStart, prependCandles, weekStart } from '../domain/candles'
import type { Candle, IntervalId } from '../domain/types'
import { KLINES_PAGE_SIZE, fetchKlines, isAbortError } from './binance'
import { fetchBitstampDailyBefore } from './bitstamp'

export interface HistoryPage {
  candles: Candle[]
  /** Há candles ainda mais antigos para buscar. */
  hasMore: boolean
}

export interface FetchHistoryParams {
  symbol: string
  interval: IntervalId
  /** Busca só candles abertos até este instante (ms). Sem ele, os mais recentes. */
  endTime?: number
  signal?: AbortSignal
}

/**
 * O BTC/USDT da Binance começa em ago/2017. Para ver os ciclos anteriores (e
 * as médias longas), os períodos de 1 dia ou mais continuam com o BTC/USD
 * diário da Bitstamp (desde 2011), agregado em semanas e meses do calendário.
 */
export function hasLongHistory(symbol: string, interval: IntervalId): boolean {
  return symbol === 'BTCUSDT' && (interval === '1d' || interval === '1w' || interval === '1M')
}

const BUCKETS: Partial<Record<IntervalId, (time: number) => number>> = {
  '1w': weekStart,
  '1M': monthStart,
}

/**
 * Uma página de histórico: até 1000 candles da Binance; quando a Binance acaba
 * e o par tem histórico longo, completa de uma vez com a Bitstamp.
 */
export async function fetchHistoryPage({
  symbol,
  interval,
  endTime,
  signal,
}: FetchHistoryParams): Promise<HistoryPage> {
  const rows = await fetchKlines({ symbol, interval, endTime, signal })
  if (rows.length >= KLINES_PAGE_SIZE) return { candles: rows, hasMore: true }
  if (!hasLongHistory(symbol, interval)) return { candles: rows, hasMore: false }

  const before =
    rows[0]?.time ??
    (endTime === undefined ? Math.floor(Date.now() / 1000) : Math.floor(endTime / 1000) + 1)
  let daily: Candle[]
  try {
    daily = await fetchBitstampDailyBefore(before, signal)
  } catch (error) {
    // Com dados da Binance em mãos, mostra o que há; rolar até a borda tenta de novo
    // (aí, sem nada novo da Binance, o erro aparece com "Tentar de novo").
    if (isAbortError(error) || rows.length === 0) throw error
    return { candles: rows, hasMore: true }
  }
  const bucket = BUCKETS[interval]
  const older = bucket ? aggregateCandles(daily, bucket) : daily
  // A primeira semana/mês da Binance é parcial (começou no meio do período);
  // prependCandles mantém a da Binance e descarta a da Bitstamp no mesmo período.
  return { candles: prependCandles(older, rows), hasMore: false }
}
