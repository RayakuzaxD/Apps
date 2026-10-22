/**
 * Indicadores técnicos como funções puras.
 * Todas as saídas têm o mesmo tamanho da entrada; posições sem valor
 * (período ainda incompleto) são `null`.
 */
export type Series = (number | null)[]

function nulls(length: number): Series {
  return new Array<number | null>(length).fill(null)
}

/** Índice do primeiro valor não nulo (entradas com nulls apenas no início). */
function firstValueIndex(values: readonly (number | null)[]): number {
  const i = values.findIndex((v) => v !== null)
  return i === -1 ? values.length : i
}

/** Média móvel simples. */
export function sma(values: readonly (number | null)[], period: number): Series {
  const out = nulls(values.length)
  const start = firstValueIndex(values)
  let sum = 0
  for (let i = start; i < values.length; i++) {
    sum += values[i]!
    if (i - start >= period) sum -= values[i - period]!
    if (i - start >= period - 1) out[i] = sum / period
  }
  return out
}

/**
 * Média móvel exponencial, alfa = 2 / (período + 1).
 * Semeada com a média simples dos primeiros `period` valores.
 */
export function ema(values: readonly (number | null)[], period: number): Series {
  const out = nulls(values.length)
  const start = firstValueIndex(values)
  const seedEnd = start + period - 1
  if (seedEnd >= values.length) return out

  let sum = 0
  for (let i = start; i <= seedEnd; i++) sum += values[i]!
  let prev = sum / period
  out[seedEnd] = prev

  const alpha = 2 / (period + 1)
  for (let i = seedEnd + 1; i < values.length; i++) {
    prev = values[i]! * alpha + prev * (1 - alpha)
    out[i] = prev
  }
  return out
}

/**
 * Índice de Força Relativa com a suavização de Wilder.
 * Série sem nenhuma variação no período resulta em 50 (neutro).
 */
export function rsi(values: readonly number[], period: number): Series {
  const out = nulls(values.length)
  if (values.length <= period) return out

  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const change = values[i]! - values[i - 1]!
    if (change > 0) gain += change
    else loss -= change
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  out[period] = rsiValue(avgGain, avgLoss)

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i]! - values[i - 1]!
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period
    out[i] = rsiValue(avgGain, avgLoss)
  }
  return out
}

function rsiValue(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export interface MacdResult {
  macd: Series
  signal: Series
  histogram: Series
}

/** MACD = MME(rápida) − MME(lenta); sinal = MME do MACD; histograma = MACD − sinal. */
export function macd(
  values: readonly number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): MacdResult {
  const fast = ema(values, fastPeriod)
  const slow = ema(values, slowPeriod)
  const line: Series = values.map((_, i) => {
    const f = fast[i]
    const s = slow[i]
    return f === null || f === undefined || s === null || s === undefined ? null : f - s
  })
  const signal = ema(line, signalPeriod)
  const histogram: Series = line.map((m, i) => {
    const s = signal[i]
    return m === null || s === null || s === undefined ? null : m - s
  })
  return { macd: line, signal, histogram }
}

export interface BollingerResult {
  middle: Series
  upper: Series
  lower: Series
}

/** Bandas de Bollinger: MMS ± multiplicador × desvio padrão populacional. */
export function bollinger(
  values: readonly number[],
  period: number,
  multiplier: number,
): BollingerResult {
  const middle = sma(values, period)
  const upper = nulls(values.length)
  const lower = nulls(values.length)
  for (let i = period - 1; i < values.length; i++) {
    const mean = middle[i]!
    let sq = 0
    for (let j = i - period + 1; j <= i; j++) sq += (values[j]! - mean) ** 2
    const dev = Math.sqrt(sq / period) * multiplier
    upper[i] = mean + dev
    lower[i] = mean - dev
  }
  return { middle, upper, lower }
}
