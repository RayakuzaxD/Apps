import { describe, expect, it } from 'vitest'
import { FIXTURE_START, fullContext } from '../../../tests/fixtures/indicatorContext'
import type { ExternalSeries } from '../../data/series'
import { weekStart } from '../candles'
import type { Candle } from '../types'
import { ema, sma } from './math'
import {
  computeIndicator,
  defaultParams,
  readIndicator,
  type ComputeContext,
  type IndicatorType,
} from './registry'
import { liveWeeks, weekIndexes } from './weekly'

const DAY = 86_400
const cfg = (type: IndicatorType, params = {}) => ({
  id: type,
  type,
  params: { ...defaultParams(type), ...params },
  visible: true,
})
const c = (time: number, close: number): Candle => ({
  time,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume: 1,
})
const series = (id: string, points: [number, number][], maxGapDays = 10): ExternalSeries => ({
  id,
  title: id,
  source: 't',
  unit: '',
  maxGapDays,
  updatedAt: '',
  points,
})

describe('semanas para indicadores em semanas', () => {
  const { candles, data } = fullContext(30)

  it('a semana em formação acompanha o preço do gráfico', () => {
    const last = candles.at(-1)!
    const weeks = liveWeeks(candles, data)!
    expect(weeks.at(-1)!.time).toBe(weekStart(last.time))
    expect(weeks.at(-1)!.close).toBe(last.close)
  })

  it('cria a semana nova se o gráfico já entrou nela', () => {
    const old = data.weekly!.slice(0, -1)
    const weeks = liveWeeks(candles, { ...data, weekly: old })!
    expect(weeks).toHaveLength(old.length + 1)
    expect(weeks.at(-1)).toMatchObject({
      time: weekStart(candles.at(-1)!.time),
      close: candles.at(-1)!.close,
    })
  })

  it('cada dia recebe a semana que o contém; no 1S, a própria vela', () => {
    const weeks = liveWeeks(candles, data)!
    const idx = weekIndexes(candles, weeks, data)
    candles.forEach((day, i) => expect(weeks[idx[i]!]!.time).toBe(weekStart(day.time)))
    expect(weekIndexes(weeks, weeks, { ...data, interval: '1w' })).toEqual(weeks.map((_, i) => i))
  })

  it('sem velas semanais: null', () => {
    expect(liveWeeks(candles, { ...data, weekly: null })).toBeNull()
  })
})

describe('Faixa de Bull Market', () => {
  const { candles, data } = fullContext(60)

  it('no 1S: MMS 20 e MME 21 dos fechamentos semanais', () => {
    const weekly = data.weekly!
    const weeklyCtx: ComputeContext = { ...data, interval: '1w', intervalSeconds: 7 * DAY }
    const { outputs } = computeIndicator(cfg('bmsb'), weekly, weeklyCtx)
    const closes = weekly.map((w) => w.close)
    expect(outputs.sma).toEqual(sma(closes, 20))
    expect(outputs.ema).toEqual(ema(closes, 21))
  })

  it('no 1D: degraus semanais, iguais dentro da semana', () => {
    const { outputs } = computeIndicator(cfg('bmsb'), candles, data)
    const byWeek = new Map<number, Set<number | null>>()
    candles.forEach((day, i) => {
      const w = weekStart(day.time)
      if (!byWeek.has(w)) byWeek.set(w, new Set())
      byWeek.get(w)!.add(outputs.sma![i]!)
    })
    for (const values of byWeek.values()) expect(values.size).toBe(1)
  })

  it('leitura: posição do preço e fechamentos semanal e mensal', () => {
    const result = computeIndicator(cfg('bmsb'), candles, data)
    const reading = readIndicator(result, candles, 2, candles.length - 1, data)!
    expect(reading.zone).toMatch(/^(acima|abaixo|dentro) da faixa$/)
    expect(reading.detail).toMatch(
      /A última semana fechada \(\d{2}\/\d{2}\/\d{4}\) fechou (acima|abaixo|dentro) da faixa\./,
    )
    expect(reading.detail).toMatch(
      /O último mês fechado \(.+ de \d{4}\) fechou (acima|abaixo|dentro) da faixa\./,
    )
  })

  it('preço bem acima da faixa: "acima da faixa" com a distância do topo', () => {
    const weeks = Array.from({ length: 30 }, (_, i) => c(FIXTURE_START + i * 7 * DAY, 100))
    weeks[29] = c(weeks[29]!.time, 200)
    const ctx: ComputeContext = {
      ...data,
      interval: '1w',
      intervalSeconds: 7 * DAY,
      weekly: null,
      monthly: null,
      now: weeks[29]!.time + DAY,
    }
    const result = computeIndicator(cfg('bmsb'), weeks, ctx)
    const reading = readIndicator(result, weeks, 2, 29, ctx)!
    expect(reading).toMatchObject({ zone: 'acima da faixa', tone: 'above' })
    expect(reading.detail).toMatch(/^Preço [\d,]+% acima do topo da faixa/)
    // A semana anterior (fechada, a 100) ficou dentro da faixa (tudo a 100).
    expect(reading.detail).toContain('fechou dentro da faixa')
  })
})

describe('médias de 50 e 200 semanas', () => {
  it('200 semanas sem histórico suficiente: sem dado', () => {
    const { candles, data } = fullContext(30)
    const short = { ...data, weekly: data.weekly!.slice(-100) }
    const { outputs } = computeIndicator(cfg('sma200w'), candles, short)
    expect(outputs.value!.every((v) => v === null)).toBe(true)
    expect(
      readIndicator(
        computeIndicator(cfg('sma200w'), candles, short),
        candles,
        2,
        candles.length - 1,
        short,
      ),
    ).toBeNull()
  })

  it('50 semanas: leitura com a posição e o fechamento da semana', () => {
    const { candles, data } = fullContext(30)
    const result = computeIndicator(cfg('sma50w'), candles, data)
    const reading = readIndicator(result, candles, 2, candles.length - 1, data)!
    expect(reading.detail).toMatch(/^Preço [\d,]+% (acima|abaixo) da MMS de 50 semanas\./)
    expect(reading.detail).toContain('fechou')
  })
})

describe('MVRV e Preço Realizado', () => {
  const day = (n: number) => FIXTURE_START + n * DAY
  const days = Array.from({ length: 5 }, (_, i) => c(day(i), 60_000))
  const ctx = (mvrv: number, symbol = 'BTCUSDT'): ComputeContext => ({
    symbol,
    interval: '1d',
    intervalSeconds: DAY,
    now: day(4) + 3600,
    weekly: null,
    monthly: null,
    external: {
      BTC_MVRV: series(
        'BTC_MVRV',
        days.map((d) => [d.time, mvrv]),
        4,
      ),
      BTC_PRICE_CM: series(
        'BTC_PRICE_CM',
        days.map((d) => [d.time, 60_000]),
        4,
      ),
    },
  })
  const read = (mvrv: number) => {
    const data = ctx(mvrv)
    return readIndicator(computeIndicator(cfg('mvrv'), days, data), days, 2, 4, data)!
  }

  it.each([
    [0.9, 'fundo', 'bottom'],
    [1.2, 'meio', 'middle'],
    [1.45, 'acumulação', 'middle'],
    [2.5, 'meio', 'middle'],
    [3.6, 'topo', 'top'],
  ] as const)('MVRV %s → %s', (mvrv, zone, tone) => {
    expect(read(mvrv)).toMatchObject({ zone, tone })
  })

  it('cita a data do último dado', () => {
    expect(read(2).detail).toContain('Último dado: 05/01/2024 (Coin Metrics).')
  })

  it('Preço Realizado = preço ÷ MVRV', () => {
    const data = ctx(2)
    const { outputs } = computeIndicator(cfg('realized'), days, data)
    expect(outputs.value).toEqual([30_000, 30_000, 30_000, 30_000, 30_000])
    const reading = readIndicator(computeIndicator(cfg('realized'), days, data), days, 2, 4, data)!
    expect(reading.detail).toMatch(/^Preço 100,00% acima do Preço Realizado \(MVRV = 1\)\./)
  })

  it('só para pares de BTC', () => {
    const data = ctx(2, 'ETHUSDT')
    expect(computeIndicator(cfg('mvrv'), days, data).outputs.value!.every((v) => v === null)).toBe(
      true,
    )
    expect(
      computeIndicator(cfg('realized'), days, data).outputs.value!.every((v) => v === null),
    ).toBe(true)
  })
})

describe('GLI', () => {
  it('cor por tendência, variação em dias e projeção com offset', () => {
    const { candles, data } = fullContext(200)
    const plain = computeIndicator(cfg('gli'), candles, data).outputs
    expect(plain.value).toHaveLength(candles.length)
    expect(plain.value!.at(-1)).toBeGreaterThan(10) // trilhões de US$
    const i = candles.length - 1
    expect(plain.trend![i]).toBe(Math.sign(plain.change![i]!))

    const shifted = computeIndicator(cfg('gli', { offsetDays: 30 }), candles, data).outputs
    // 30 dias à frente: o valor de hoje é o de 30 dias atrás, e há 30 pontos além da última vela.
    expect(shifted.value).toHaveLength(candles.length + 30)
    expect(shifted.value![i]).toBeCloseTo(plain.value![i - 30]!, 10)
    expect(shifted.value!.at(-1)).toBeCloseTo(plain.value![i]!, 10)
  })

  it('leitura: valor em trilhões, direção e offset', () => {
    const { candles, data } = fullContext(200)
    const result = computeIndicator(cfg('gli', { offsetDays: 30 }), candles, data)
    const reading = readIndicator(result, candles, 2, candles.length - 1, data)!
    expect(reading.value).toMatch(/^US\$ [\d,]+ tri$/)
    expect(['subindo', 'caindo', 'estável']).toContain(reading.zone)
    expect(reading.detail).toContain('Deslocado 30 dias')
    expect(reading.detail).toContain('a linha segue 30 velas à frente')
  })

  it('sem algum componente: sem dado', () => {
    const { candles, data } = fullContext(30)
    const { DEXJPUS: _missing, ...rest } = data.external
    const result = computeIndicator(cfg('gli'), candles, { ...data, external: rest })
    expect(result.outputs.value!.every((v) => v === null)).toBe(true)
  })
})

describe('NFCI', () => {
  const weeks = Array.from({ length: 6 }, (_, i) => c(FIXTURE_START + i * 7 * DAY, 1))
  const ctx = (values: number[]): ComputeContext => ({
    symbol: 'BTCUSDT',
    interval: '1w',
    intervalSeconds: 7 * DAY,
    now: weeks.at(-1)!.time + DAY,
    weekly: null,
    monthly: null,
    external: {
      NFCI: series(
        'NFCI',
        weeks.map((w, i) => [w.time, values[i]!]),
      ),
    },
  })
  const read = (values: number[]) => {
    const data = ctx(values)
    return readIndicator(computeIndicator(cfg('nfci'), weeks, data), weeks, 2, 5, data)!
  }

  it('afrouxou 0,05 ou mais em 4 semanas: verde (afrouxando)', () => {
    const r = read([0, 0, -0.1, -0.1, -0.1, -0.12])
    expect(r).toMatchObject({ zone: 'afrouxando', tone: 'loosening', value: '-0,120' })
    expect(r.detail).toContain('Variação de -0,120 em 4 semanas (limiar 0,05).')
  })

  it('apertou 0,05 ou mais: vermelho (apertando)', () => {
    expect(read([0, 0, 0.1, 0.1, 0.1, 0.06])).toMatchObject({
      zone: 'apertando',
      tone: 'tightening',
    })
  })

  it('mudança menor que o limiar: estável', () => {
    expect(read([0, 0, 0, 0, 0, 0.02])).toMatchObject({ zone: 'estável', tone: 'neutral' })
  })

  it('a tendência (1 afrouxa, -1 aperta) colore a linha', () => {
    const { outputs } = computeIndicator(cfg('nfci'), weeks, ctx([0, 0, -0.1, -0.1, -0.1, -0.12]))
    expect(outputs.trend!.at(-1)).toBe(1)
  })
})
