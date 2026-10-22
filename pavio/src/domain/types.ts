/** Candle OHLCV. `time` é o horário de abertura em segundos UTC. */
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type IntervalId = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export interface IntervalDef {
  id: IntervalId
  label: string
  seconds: number
}
