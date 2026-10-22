import type { IntervalDef, IntervalId } from './types'

export const INTERVALS: readonly IntervalDef[] = [
  { id: '1m', label: '1m', seconds: 60 },
  { id: '5m', label: '5m', seconds: 5 * 60 },
  { id: '15m', label: '15m', seconds: 15 * 60 },
  { id: '1h', label: '1h', seconds: 60 * 60 },
  { id: '4h', label: '4h', seconds: 4 * 60 * 60 },
  { id: '1d', label: '1D', seconds: 24 * 60 * 60 },
]

export const DEFAULT_INTERVAL: IntervalId = '1h'

export function isIntervalId(value: unknown): value is IntervalId {
  return INTERVALS.some((i) => i.id === value)
}

export function getInterval(id: IntervalId): IntervalDef {
  const def = INTERVALS.find((i) => i.id === id)
  if (!def) throw new Error(`Intervalo desconhecido: ${id}`)
  return def
}

/** Intervalos diários ou maiores não exibem horário. */
export function isIntraday(id: IntervalId): boolean {
  return getInterval(id).seconds < 24 * 60 * 60
}
