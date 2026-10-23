import type { ExternalSeries } from '../data/series'
import type { Series } from './indicators/math'
import type { Candle } from './types'

export const DAY = 86_400

/** Pontos `[tempo, valor]` em ordem, com a defasagem máxima aceita. */
export interface TimedSeries {
  points: readonly (readonly [number, number])[]
  maxGapDays: number
}

/** Índice do último ponto com tempo ≤ `time` (busca binária), ou -1. */
export function lastIndexAtOrBefore(
  points: readonly (readonly [number, number])[],
  time: number,
): number {
  let lo = 0
  let hi = points.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (points[mid]![0] <= time) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

/**
 * Valor em vigor no instante `time`: a última observação até ele, desde que não
 * esteja mais velha que `maxGapDays` (senão, "sem dado" em vez de repetir um
 * valor antigo).
 */
export function valueAsOf(series: TimedSeries, time: number): number | null {
  const i = lastIndexAtOrBefore(series.points, time)
  if (i < 0) return null
  const [t, v] = series.points[i]!
  return time - t <= series.maxGapDays * DAY ? v : null
}

export interface AlignOptions {
  /** Duração da vela (mês: média; o gráfico extrapola o futuro com o mesmo passo). */
  intervalSeconds: number
  /** Desloca a série para frente: o valor de D aparece em D + offset. */
  offsetDays?: number
  /** Agora (segundos): a vela em formação usa o valor de agora. */
  now: number
}

/**
 * Instante "de leitura" de cada vela: o fim do período (último segundo antes da
 * próxima vela), ou agora para a vela em formação.
 */
function readTimes(candles: readonly Candle[], { intervalSeconds, now }: AlignOptions): number[] {
  return candles.map((c, i) => {
    const end = candles[i + 1]?.time ?? c.time + intervalSeconds
    return Math.min(end - 1, now)
  })
}

/**
 * Série externa nas velas do gráfico. Com offset > 0, gera também pontos à
 * frente do último candle enquanto houver dado deslocado (projeção), no mesmo
 * passo que o gráfico usa para o espaço vazio à direita.
 */
export function alignToCandles(
  series: TimedSeries,
  candles: readonly Candle[],
  options: AlignOptions,
): Series {
  const shift = Math.round((options.offsetDays ?? 0) * DAY)
  const values: Series = readTimes(candles, options).map((t) => valueAsOf(series, t - shift))
  const last = candles[candles.length - 1]
  const lastObs = series.points[series.points.length - 1]
  if (shift > 0 && last && lastObs) {
    for (let k = 1; ; k++) {
      const start = last.time + k * options.intervalSeconds
      if (start - shift > lastObs[0]) break
      values.push(valueAsOf(series, start + options.intervalSeconds - 1 - shift))
    }
  }
  return values
}

/**
 * Variação da série em `lookbackDays` dias no instante de leitura de cada vela
 * (com o mesmo offset), ex.: NFCI em 4 semanas. Nulo sem os dois valores.
 */
export function changeOver(
  series: TimedSeries,
  candles: readonly Candle[],
  options: AlignOptions,
  lookbackDays: number,
): Series {
  const shift = Math.round((options.offsetDays ?? 0) * DAY)
  const back = lookbackDays * DAY
  const change = (t: number) => {
    const now = valueAsOf(series, t - shift)
    const before = valueAsOf(series, t - shift - back)
    return now === null || before === null ? null : now - before
  }
  const values: Series = readTimes(candles, options).map(change)
  const last = candles[candles.length - 1]
  const lastObs = series.points[series.points.length - 1]
  if (shift > 0 && last && lastObs) {
    for (let k = 1; ; k++) {
      const start = last.time + k * options.intervalSeconds
      if (start - shift > lastObs[0]) break
      values.push(change(start + options.intervalSeconds - 1))
    }
  }
  return values
}

/** Tendência: 1 (subiu além do limiar), -1 (caiu além do limiar), 0 (estável), null (sem dado). */
export function trendFromChange(change: Series, threshold: number): Series {
  return change.map((d) =>
    d === null ? null : d >= threshold && d > 0 ? 1 : d <= -threshold && d < 0 ? -1 : 0,
  )
}

/** Componentes do GLI (Índice de Liquidez Global), como baixados do FRED. */
export const GLI_INPUTS = [
  'WALCL',
  'WTREGEN',
  'RRPONTSYD',
  'ECBASSETSW',
  'JPNASSETS',
  'DEXUSEU',
  'DEXJPUS',
] as const

export type GliInputs = Record<(typeof GLI_INPUTS)[number], ExternalSeries>

/**
 * GLI em trilhões de US$ no instante `time`:
 * balanço do FED − TGA − RRP + balanço do BCE (em US$) + balanço do BoJ (em US$).
 * Unidades do FRED: WALCL e WTREGEN em milhões de US$, RRPONTSYD em bilhões,
 * ECBASSETSW em milhões de €, JPNASSETS em centenas de milhões de ¥;
 * DEXUSEU em US$/€ e DEXJPUS em ¥/US$. Falta de qualquer componente = sem dado.
 */
export function gliAt(inputs: GliInputs, time: number): number | null {
  const v = (id: keyof GliInputs) => valueAsOf(inputs[id], time)
  const fed = v('WALCL')
  const tga = v('WTREGEN')
  const rrp = v('RRPONTSYD')
  const ecb = v('ECBASSETSW')
  const eurUsd = v('DEXUSEU')
  const boj = v('JPNASSETS')
  const usdJpy = v('DEXJPUS')
  if ([fed, tga, rrp, ecb, eurUsd, boj, usdJpy].some((x) => x === null) || usdJpy === 0) {
    return null
  }
  const trillions =
    fed! / 1e6 - tga! / 1e6 - rrp! / 1e3 + (ecb! * eurUsd!) / 1e6 + (boj! * 1e8) / usdJpy! / 1e12
  return trillions
}

const gliCache = new WeakMap<GliInputs, TimedSeries>()

/**
 * Série diária do GLI, calculada nas datas em que algum componente muda.
 * Memorizada por conjunto de entradas (os arquivos mudam 1× por dia).
 */
export function gliSeries(inputs: GliInputs): TimedSeries {
  const cached = gliCache.get(inputs)
  if (cached) return cached
  const times = [...new Set(GLI_INPUTS.flatMap((id) => inputs[id].points.map(([t]) => t)))].sort(
    (a, b) => a - b,
  )
  const points: [number, number][] = []
  for (const t of times) {
    const value = gliAt(inputs, t)
    if (value !== null) points.push([t, value])
  }
  const series = { points, maxGapDays: 10 }
  gliCache.set(inputs, series)
  return series
}
