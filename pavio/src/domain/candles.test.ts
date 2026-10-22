import { describe, expect, it } from 'vitest'
import {
  aggregateCandles,
  findCandleIndex,
  mergeCandle,
  mergeCandles,
  prependCandles,
  monthStart,
  periodEnd,
  pricePrecision,
  weekStart,
} from './candles'
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

describe('prependCandles', () => {
  const times = (cs: Candle[]) => cs.map((x) => x.time)

  it('junta histórico anterior ao início', () => {
    expect(times(prependCandles([c(1), c(2)], [c(3), c(4)]))).toEqual([1, 2, 3, 4])
  })

  it('descarta candles sobrepostos e mantém os da série atual', () => {
    const result = prependCandles([c(1), c(2, 9), c(3, 9)], [c(2), c(3)])
    expect(times(result)).toEqual([1, 2, 3])
    expect(result[1]!.close).toBe(1)
  })

  it('devolve a mesma série quando não há nada anterior', () => {
    const series = [c(3), c(4)]
    expect(prependCandles([], series)).toBe(series)
    expect(prependCandles([c(5)], series)).toBe(series)
  })

  it('aceita série atual vazia', () => {
    expect(times(prependCandles([c(1)], []))).toEqual([1])
  })
})

describe('findCandleIndex', () => {
  const series = [c(10), c(20), c(30), c(40)]

  it.each([
    [10, 0],
    [30, 2],
    [40, 3],
    [25, -1],
    [5, -1],
  ])('horário %i -> índice %i', (time, expected) => {
    expect(findCandleIndex(series, time)).toBe(expected)
  })

  it('aceita série vazia', () => {
    expect(findCandleIndex([], 10)).toBe(-1)
  })
})

const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000

describe('semana e mês do calendário', () => {
  it('a semana começa na segunda 00:00 UTC (domingo 21h de Brasília)', () => {
    const monday = utc(2026, 10, 19)
    expect(weekStart(monday)).toBe(monday)
    expect(weekStart(utc(2026, 10, 22) + 15 * 3600)).toBe(monday) // quinta à tarde
    expect(weekStart(utc(2026, 10, 25) + 23 * 3600)).toBe(monday) // domingo 23h UTC
    expect(weekStart(utc(2026, 10, 26))).toBe(utc(2026, 10, 26))
  })

  it('fim do período: mês do calendário exato, demais pela duração', () => {
    expect(periodEnd(utc(2026, 10, 1), 2_629_800, true)).toBe(utc(2026, 11, 1))
    expect(periodEnd(utc(2024, 2, 1), 2_629_800, true)).toBe(utc(2024, 3, 1))
    expect(periodEnd(utc(2026, 10, 19), 7 * 86_400, false)).toBe(utc(2026, 10, 26))
  })

  it('o mês começa no dia 1º 00:00 UTC', () => {
    expect(monthStart(utc(2024, 2, 29) + 3600)).toBe(utc(2024, 2, 1))
    expect(monthStart(utc(2026, 12, 31))).toBe(utc(2026, 12, 1))
  })
})

describe('aggregateCandles', () => {
  const day = (y: number, m: number, d: number, o: number, h: number, l: number, cl: number) => ({
    time: utc(y, m, d),
    open: o,
    high: h,
    low: l,
    close: cl,
    volume: 1,
  })

  it('agrupa dias em semanas: abertura do 1º, fechamento do último, máx/mín e volume somado', () => {
    const days = [
      day(2026, 10, 18, 10, 12, 9, 11), // domingo: semana anterior
      day(2026, 10, 19, 11, 15, 10, 14),
      day(2026, 10, 20, 14, 16, 8, 9),
      day(2026, 10, 25, 9, 10, 7, 8), // domingo: fecha a semana
      day(2026, 10, 26, 8, 9, 8, 9),
    ]
    expect(aggregateCandles(days, weekStart)).toEqual([
      { time: utc(2026, 10, 12), open: 10, high: 12, low: 9, close: 11, volume: 1 },
      { time: utc(2026, 10, 19), open: 11, high: 16, low: 7, close: 8, volume: 3 },
      { time: utc(2026, 10, 26), open: 8, high: 9, low: 8, close: 9, volume: 1 },
    ])
  })

  it('agrupa em meses e não altera os candles de entrada', () => {
    const days = [
      day(2026, 1, 31, 1, 2, 1, 2),
      day(2026, 2, 1, 2, 3, 1, 3),
      day(2026, 2, 28, 3, 5, 2, 4),
    ]
    const copy = structuredClone(days)
    const months = aggregateCandles(days, monthStart)
    expect(months.map((m) => [m.time, m.open, m.close, m.volume])).toEqual([
      [utc(2026, 1, 1), 1, 2, 1],
      [utc(2026, 2, 1), 2, 4, 2],
    ])
    expect(days).toEqual(copy)
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
