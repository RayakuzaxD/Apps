import type { IntervalDef, IntervalId } from './types'

const DAY = 24 * 60 * 60

export const INTERVALS: readonly IntervalDef[] = [
  { id: '1m', name: '1 minuto', label: '1m', seconds: 60 },
  { id: '5m', name: '5 minutos', label: '5m', seconds: 5 * 60 },
  { id: '15m', name: '15 minutos', label: '15m', seconds: 15 * 60 },
  { id: '1h', name: '1 hora', label: '1h', seconds: 60 * 60 },
  { id: '4h', name: '4 horas', label: '4h', seconds: 4 * 60 * 60 },
  { id: '1d', name: '1 dia', label: '1D', seconds: DAY },
  // Semana do calendário da Binance: abre segunda 00:00 UTC (domingo 21h de Brasília).
  { id: '1w', name: '1 semana', label: '1S', seconds: 7 * DAY },
  // Mês do calendário; a duração varia, então usamos a média (365,25 / 12 dias).
  { id: '1M', name: '1 mês', label: '1M', seconds: Math.round((365.25 / 12) * DAY) },
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
  return getInterval(id).seconds < DAY
}

/** Detalhe de data exibido no crosshair para o intervalo. */
export type TimeDetail = 'intraday' | 'day' | 'month'

export function timeDetail(id: IntervalId): TimeDetail {
  if (id === '1M') return 'month'
  return isIntraday(id) ? 'intraday' : 'day'
}
