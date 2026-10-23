import { weekStart } from '../candles'
import { lastIndexAtOrBefore } from '../external'
import type { Candle } from '../types'
import type { Series } from './math'
import type { ComputeContext } from './types'

const WEEK = 7 * 86_400

/**
 * Velas semanais para indicadores em semanas: no 1S, as do próprio gráfico; nos
 * demais, as baixadas à parte, com a semana em formação acompanhando o preço
 * do gráfico (como o `request.security` semanal do TradingView).
 */
export function liveWeeks(candles: readonly Candle[], data: ComputeContext): Candle[] | null {
  if (data.interval === '1w') return candles as Candle[]
  const weekly = data.weekly
  if (!weekly || weekly.length === 0) return null
  const last = candles[candles.length - 1]
  const lastWeek = weekly[weekly.length - 1]!
  // Só gráficos mais curtos que a semana trazem preço mais novo que a semana baixada.
  if (!last || data.intervalSeconds >= WEEK) return weekly as Candle[]
  const week = weekStart(last.time)
  if (week === lastWeek.time) {
    return [
      ...weekly.slice(0, -1),
      {
        ...lastWeek,
        close: last.close,
        high: Math.max(lastWeek.high, last.high),
        low: Math.min(lastWeek.low, last.low),
      },
    ]
  }
  if (week > lastWeek.time) {
    return [
      ...weekly,
      { time: week, open: last.open, high: last.high, low: last.low, close: last.close, volume: 0 },
    ]
  }
  return weekly as Candle[]
}

/**
 * Para cada vela do gráfico, o índice da semana que contém o fim dela (ou agora,
 * para a vela em formação); -1 se for anterior à primeira semana.
 */
export function weekIndexes(
  candles: readonly Candle[],
  weeks: readonly Candle[],
  data: ComputeContext,
): number[] {
  if (data.interval === '1w') return candles.map((_, i) => i)
  const starts = weeks.map((w) => [w.time, 0] as const)
  return candles.map((c, i) => {
    const end = candles[i + 1]?.time ?? c.time + data.intervalSeconds
    return lastIndexAtOrBefore(starts, Math.min(end - 1, data.now))
  })
}

/** Leva uma série semanal para as velas do gráfico. */
export function mapWeekly(weekly: Series, indexes: readonly number[]): Series {
  return indexes.map((w) => (w < 0 ? null : (weekly[w] ?? null)))
}

/** Índice da última semana já fechada em `weeks` (a última pode estar em formação). */
export function lastClosedIndex(
  periods: readonly Candle[],
  now: number,
  nextStart: (t: number) => number,
) {
  const n = periods.length
  if (n === 0) return -1
  return now < nextStart(periods[n - 1]!.time) ? n - 2 : n - 1
}
