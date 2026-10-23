import { describe, expect, it } from 'vitest'
import type { ExternalSeries } from '../data/series'
import {
  DAY,
  GLI_INPUTS,
  alignToCandles,
  changeOver,
  gliAt,
  gliSeries,
  lastIndexAtOrBefore,
  trendFromChange,
  valueAsOf,
  type GliInputs,
} from './external'
import type { Candle } from './types'

const d = (n: number) => n * DAY
const candle = (time: number): Candle => ({ time, open: 1, high: 1, low: 1, close: 1, volume: 1 })
const weekly = {
  points: [
    [d(0), 10],
    [d(7), 20],
    [d(14), 30],
  ] as [number, number][],
  maxGapDays: 10,
}

describe('valor em vigor', () => {
  it('busca a última observação até o instante', () => {
    expect(lastIndexAtOrBefore(weekly.points, d(-1))).toBe(-1)
    expect(lastIndexAtOrBefore(weekly.points, d(7))).toBe(1)
    expect(lastIndexAtOrBefore(weekly.points, d(13))).toBe(1)
    expect(lastIndexAtOrBefore(weekly.points, d(99))).toBe(2)
  })

  it('repete o valor até o limite de defasagem; depois, sem dado', () => {
    expect(valueAsOf(weekly, d(3))).toBe(10)
    expect(valueAsOf(weekly, d(24))).toBe(30)
    expect(valueAsOf(weekly, d(24) + 1)).toBeNull()
    expect(valueAsOf(weekly, d(-1))).toBeNull()
  })
})

describe('alinhamento às velas', () => {
  const daily = Array.from({ length: 20 }, (_, i) => candle(d(i)))

  it('usa o valor do fim de cada vela; a vela em formação usa o valor de agora', () => {
    const values = alignToCandles(weekly, daily, { intervalSeconds: DAY, now: d(19) + 3600 })
    expect(values.slice(0, 8)).toEqual([10, 10, 10, 10, 10, 10, 10, 20])
    expect(values[19]).toBe(30)
    expect(values).toHaveLength(20)
  })

  it('semanal: vale o último dado dentro da semana (o do dia 7 já é da semana seguinte)', () => {
    const weeks = [candle(d(0)), candle(d(7)), candle(d(14))]
    expect(alignToCandles(weekly, weeks, { intervalSeconds: d(7), now: d(30) })).toEqual([
      10, 20, 30,
    ])
  })

  it('offset desloca para frente e projeta além do último candle', () => {
    const series = {
      points: [
        [d(0), 1],
        [d(1), 2],
        [d(2), 3],
        [d(3), 4],
      ] as [number, number][],
      maxGapDays: 2,
    }
    const days = [candle(d(0)), candle(d(1)), candle(d(2)), candle(d(3))]
    const values = alignToCandles(series, days, { intervalSeconds: DAY, offsetDays: 2, now: d(4) })
    // Velas: valor de 2 dias antes; depois, 2 pontos futuros (dias 4 e 5).
    expect(values).toEqual([null, null, 1, 2, 3, 4])
  })

  it('sem offset não projeta', () => {
    expect(
      alignToCandles(weekly, [candle(d(0))], { intervalSeconds: DAY, now: d(1) }),
    ).toHaveLength(1)
  })
})

describe('variação e tendência', () => {
  it('variação em N dias e tendência com limiar', () => {
    const nfci = {
      points: [
        [d(0), -0.4],
        [d(7), -0.42],
        [d(14), -0.45],
        [d(21), -0.47],
        [d(28), -0.48],
      ] as [number, number][],
      maxGapDays: 10,
    }
    const weeks = [0, 7, 14, 21, 28].map((n) => candle(d(n)))
    const change = changeOver(nfci, weeks, { intervalSeconds: d(7), now: d(40) }, 28)
    expect(change.slice(0, 4)).toEqual([null, null, null, null])
    // Última semana: leitura no dia 34 (-0,48) contra 28 dias antes, dia 6 (-0,40).
    expect(change[4]).toBeCloseTo(-0.08, 10)
    expect(trendFromChange([0.06, -0.06, 0.01, 0, null], 0.05)).toEqual([1, -1, 0, 0, null])
    expect(trendFromChange([0.01, -0.01, 0], 0)).toEqual([1, -1, 0])
  })
})

describe('GLI', () => {
  const series = (id: string, value: number, from = 0): ExternalSeries => ({
    id,
    title: id,
    source: 'FRED',
    unit: '',
    maxGapDays: 10,
    updatedAt: '',
    points: [[d(from), value]],
  })
  const inputs: GliInputs = {
    WALCL: series('WALCL', 7_000_000), // 7 tri
    WTREGEN: series('WTREGEN', 800_000), // 0,8 tri
    RRPONTSYD: series('RRPONTSYD', 200), // 0,2 tri
    ECBASSETSW: series('ECBASSETSW', 6_000_000), // 6 tri €
    DEXUSEU: series('DEXUSEU', 1.1),
    JPNASSETS: series('JPNASSETS', 6_000_000), // 600 tri ¥
    DEXJPUS: series('DEXJPUS', 150, 1),
  }

  it('soma FED − TGA − RRP + BCE e BoJ em dólar, em trilhões', () => {
    expect(gliAt(inputs, d(1))).toBeCloseTo(7 - 0.8 - 0.2 + 6.6 + 4, 10)
  })

  it('falta de um componente = sem dado', () => {
    expect(gliAt(inputs, d(0))).toBeNull() // câmbio do iene só a partir do dia 1
    expect(gliAt(inputs, d(30))).toBeNull() // dados velhos demais
  })

  it('série diária nas datas dos componentes, memorizada', () => {
    const s = gliSeries(inputs)
    expect(s.points).toHaveLength(1)
    expect(s.points[0]![0]).toBe(d(1))
    expect(gliSeries(inputs)).toBe(s)
    expect(GLI_INPUTS).toHaveLength(7)
  })
})
