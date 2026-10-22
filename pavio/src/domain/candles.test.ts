import { describe, expect, it } from 'vitest'
import { mergeCandle, mergeCandles, pricePrecision } from './candles'
import type { Candle } from './types'

const c = (time: number, close = 1): Candle => ({
  time,
  open: 1,
  high: 2,
  low: 0.5,
  close,
  volume: 10,
})

describe('mergeCandle', () => {
  it('anexa candle com horário novo', () => {
    expect(mergeCandle([c(1), c(2)], c(3)).map((x) => x.time)).toEqual([1, 2, 3])
  })

  it('substitui o último candle quando o horário é o mesmo', () => {
    const result = mergeCandle([c(1), c(2)], c(2, 9))
    expect(result).toHaveLength(2)
    expect(result[1]!.close).toBe(9)
  })

  it('não muta o array original', () => {
    const original = [c(1), c(2)]
    mergeCandle(original, c(2, 9))
    expect(original[1]!.close).toBe(1)
  })

  it('substitui candle antigo existente e ignora horário antigo inexistente', () => {
    const series = [c(1), c(3), c(5)]
    expect(mergeCandle(series, c(3, 7))[1]!.close).toBe(7)
    expect(mergeCandle(series, c(2))).toBe(series)
  })

  it('aceita série vazia', () => {
    expect(mergeCandle([], c(1))).toEqual([c(1)])
  })

  it('mergeCandles aplica atualizações em ordem', () => {
    const result = mergeCandles([c(1)], [c(1, 2), c(2, 3), c(2, 4)])
    expect(result.map((x) => [x.time, x.close])).toEqual([
      [1, 2],
      [2, 4],
    ])
  })
})

describe('pricePrecision', () => {
  it.each([
    [83_000, 2],
    [150, 2],
    [15.3, 3],
    [2.45, 4],
    [0.17, 5],
    [0.00025, 6],
    [0.00000123, 8],
  ])('%f -> %i casas', (price, expected) => {
    expect(pricePrecision(price)).toBe(expected)
  })
})
