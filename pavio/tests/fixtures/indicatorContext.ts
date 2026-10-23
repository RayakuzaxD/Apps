import { SERIES, type ExternalSeries } from '../../src/data/series'
import type { ComputeContext } from '../../src/domain/indicators/types'
import type { Candle } from '../../src/domain/types'

const DAY = 86_400
/** Segunda-feira, 01/01/2024 00:00 UTC. */
export const FIXTURE_START = Date.UTC(2024, 0, 1) / 1000

/** Valores plausíveis por série (para cálculos de GLI, MVRV etc. não darem zero). */
const BASE: Record<string, number> = {
  WALCL: 7_000_000,
  WTREGEN: 800_000,
  RRPONTSYD: 300,
  ECBASSETSW: 6_000_000,
  JPNASSETS: 6_000_000,
  DEXUSEU: 1.1,
  DEXJPUS: 150,
  NFCI: -0.4,
  BTC_MVRV: 1.8,
  BTC_PRICE_CM: 60_000,
}

/** Série diária sintética de `from` a `to` (segundos), com valores plausíveis para o id. */
export function syntheticSeries(id: string, from: number, to: number): ExternalSeries {
  const spec = SERIES.find((s) => s.id === id)!
  const points: [number, number][] = []
  for (let t = from; t <= to; t += DAY) {
    points.push([t, BASE[id]! * (1 + 0.05 * Math.sin(t / (40 * DAY)))])
  }
  return {
    id,
    title: spec.title,
    source: spec.source,
    unit: spec.unit,
    maxGapDays: spec.maxGapDays,
    updatedAt: '',
    points,
  }
}

function candle(time: number, close: number): Candle {
  return { time, open: close * 0.99, high: close * 1.02, low: close * 0.97, close, volume: 10 }
}

/** Diárias, semanais (5 anos) e mensais terminando no mesmo dia, mais todas as séries externas. */
export function fullContext(days = 400, symbol = 'BTCUSDT') {
  const price = (t: number) => 50_000 + 20_000 * Math.sin(t / (90 * DAY))
  const daily = Array.from({ length: days }, (_, i) =>
    candle(FIXTURE_START + i * DAY, price(FIXTURE_START + i * DAY)),
  )
  const last = daily[daily.length - 1]!.time
  const weekly = Array.from({ length: 260 }, (_, i) => {
    const t = FIXTURE_START + (Math.floor((days - 1) / 7) - 259 + i) * 7 * DAY
    return candle(t, price(t))
  })
  const monthly = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(last * 1000)
    const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 23 + i, 1) / 1000
    return candle(t, price(t))
  })
  const external: Record<string, ExternalSeries> = {}
  for (const spec of SERIES) {
    external[spec.id] = syntheticSeries(spec.id, FIXTURE_START - 400 * DAY, last)
  }
  const data: ComputeContext = {
    symbol,
    interval: '1d',
    intervalSeconds: DAY,
    now: last + 3600,
    weekly,
    monthly,
    external,
  }
  return { candles: daily, data }
}
