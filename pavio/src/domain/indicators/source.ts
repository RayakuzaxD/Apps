import type { Candle } from '../types'

export type PriceSource = 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4'

export const PRICE_SOURCES: readonly { id: PriceSource; label: string }[] = [
  { id: 'close', label: 'Fechamento' },
  { id: 'open', label: 'Abertura' },
  { id: 'high', label: 'Máxima' },
  { id: 'low', label: 'Mínima' },
  { id: 'hl2', label: '(M+m)/2' },
  { id: 'hlc3', label: '(M+m+F)/3' },
  { id: 'ohlc4', label: '(A+M+m+F)/4' },
]

export function isPriceSource(value: unknown): value is PriceSource {
  return PRICE_SOURCES.some((s) => s.id === value)
}

export function sourceValues(candles: readonly Candle[], source: PriceSource): number[] {
  switch (source) {
    case 'close':
      return candles.map((c) => c.close)
    case 'open':
      return candles.map((c) => c.open)
    case 'high':
      return candles.map((c) => c.high)
    case 'low':
      return candles.map((c) => c.low)
    case 'hl2':
      return candles.map((c) => (c.high + c.low) / 2)
    case 'hlc3':
      return candles.map((c) => (c.high + c.low + c.close) / 3)
    case 'ohlc4':
      return candles.map((c) => (c.open + c.high + c.low + c.close) / 4)
  }
}
