import type { Candle } from '../../domain/types'

/** Linha de /api/v3/klines: [openTime, open, high, low, close, volume, closeTime, ...]. */
export type RestKline = [number, string, string, string, string, string, number, ...unknown[]]

export interface KlineEvent {
  symbol: string
  interval: string
  candle: Candle
  isClosed: boolean
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) throw new Error(`Valor numérico inválido: ${String(value)}`)
  return n
}

export function parseRestKline(row: unknown): Candle {
  if (!Array.isArray(row) || row.length < 6) throw new Error('Kline em formato inesperado')
  return {
    time: Math.floor(toNumber(row[0]) / 1000),
    open: toNumber(row[1]),
    high: toNumber(row[2]),
    low: toNumber(row[3]),
    close: toNumber(row[4]),
    volume: toNumber(row[5]),
  }
}

/** Evento do stream `<symbol>@kline_<interval>`. Retorna null para mensagens de outro tipo. */
export function parseKlineEvent(data: unknown): KlineEvent | null {
  if (typeof data !== 'object' || data === null) return null
  const msg = data as { e?: unknown; s?: unknown; k?: Record<string, unknown> }
  if (msg.e !== 'kline' || typeof msg.k !== 'object' || msg.k === null) return null
  const k = msg.k
  return {
    symbol: String(msg.s),
    interval: String(k.i),
    isClosed: k.x === true,
    candle: {
      time: Math.floor(toNumber(k.t) / 1000),
      open: toNumber(k.o),
      high: toNumber(k.h),
      low: toNumber(k.l),
      close: toNumber(k.c),
      volume: toNumber(k.v),
    },
  }
}

export function klineStreamName(symbol: string, interval: string): string {
  return `${symbol.toLowerCase()}@kline_${interval}`
}
