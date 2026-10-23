import { monthStart } from '../candles'
import { alignToCandles, lastIndexAtOrBefore, type TimedSeries } from '../external'
import { formatPrice } from '../format'
import type { Candle } from '../types'
import { ema, sma, type Series } from './math'
import { readPriceVsLine, valueAt, type Reading } from './readings'
import type { ComputeContext, IndicatorDef, IndicatorParams, ReadingContext } from './types'
import { lastClosedIndex, liveWeeks, mapWeekly, weekIndexes } from './weekly'
import { ZONES } from './zones'

const WEEK = 7 * 86_400
const num = (params: IndicatorParams, key: string) => params[key] as number
const fmt = (value: number, digits = 2) => formatPrice(value, digits)
const nulls = (n: number): Series => Array.from({ length: n }, () => null)
const isBtc = (symbol: string) => symbol.startsWith('BTC')

function dateLabel(time: number): string {
  return new Date(time * 1000).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function monthLabel(time: number): string {
  return new Date(time * 1000).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

type Side = 'acima' | 'abaixo' | 'dentro'

function sideOf(price: number, low: number, high: number): Side {
  return price > high ? 'acima' : price < low ? 'abaixo' : 'dentro'
}

const nextWeek = (t: number) => t + WEEK
const nextMonth = (t: number) => monthStart(t + 32 * 86_400)

/** Médias semanais calculadas sobre as semanas e o índice da semana de cada vela. */
function weeklyLines(
  candles: readonly Candle[],
  data: ComputeContext,
  lines: (closes: number[]) => Record<string, Series>,
) {
  const weeks = liveWeeks(candles, data)
  if (!weeks) return null
  const perWeek = lines(weeks.map((w) => w.close))
  return { weeks, perWeek, indexes: weekIndexes(candles, weeks, data) }
}

/**
 * Como fechou a última semana (e o último mês) já encerrados em relação a uma
 * linha ou faixa semanal. Frases só de fato, para a leitura.
 */
function closingFacts(
  ctx: ReadingContext,
  band: (weekIndex: number) => { low: number; high: number } | null,
  what: string,
): string[] {
  const facts: string[] = []
  const weeks = liveWeeks(ctx.candles, ctx.data)
  if (!weeks) return facts
  const describe = (side: Side) => `${side} ${what}`

  const w = lastClosedIndex(weeks, ctx.data.now, nextWeek)
  const wBand = w >= 0 ? band(w) : null
  if (w >= 0 && wBand) {
    const side = sideOf(weeks[w]!.close, wBand.low, wBand.high)
    facts.push(`A última semana fechada (${dateLabel(weeks[w]!.time)}) fechou ${describe(side)}.`)
  }

  const months = ctx.data.interval === '1M' ? ctx.candles : ctx.data.monthly
  if (months && months.length > 0) {
    const m = lastClosedIndex(months, ctx.data.now, nextMonth)
    if (m >= 0) {
      const monthEnd = nextMonth(months[m]!.time) - 1
      const starts = weeks.map((x) => [x.time, 0] as const)
      const wi = lastIndexAtOrBefore(starts, monthEnd)
      const mBand = wi >= 0 ? band(wi) : null
      if (mBand) {
        const side = sideOf(months[m]!.close, mBand.low, mBand.high)
        facts.push(
          `O último mês fechado (${monthLabel(months[m]!.time)}) fechou ${describe(side)}.`,
        )
      }
    }
  }
  return facts
}

/** Média simples de N semanas, válida em qualquer tempo gráfico. */
function weeklySma(
  type: 'sma50w' | 'sma200w',
  period: number,
  color: string,
  about: IndicatorDef['about'],
  description: string,
): IndicatorDef {
  return {
    type,
    name: `Média de ${period} semanas`,
    short: 'MMS',
    label: (p) => `MMS ${num(p, 'period')}s`,
    description,
    pack: 'cycle',
    about,
    placement: 'overlay',
    requires: { weekly: true },
    params: [
      { key: 'period', label: 'Período (semanas)', kind: 'int', min: 2, max: 400, default: period },
      { key: 'color', label: 'Cor', kind: 'color', default: color },
    ],
    outputs: [{ key: 'value', label: `MMS ${period} semanas`, style: 'line', colorParam: 'color' }],
    compute: (candles, p, data) => {
      const lines = weeklyLines(candles, data, (closes) => ({
        value: sma(closes, num(p, 'period')),
      }))
      if (!lines) return { value: nulls(candles.length) }
      return { value: mapWeekly(lines.perWeek.value!, lines.indexes) }
    },
    read: (ctx) => {
      const line = valueAt(ctx.outputs.value, ctx.index)
      const close = ctx.candles[ctx.index]?.close
      if (line === null || close === undefined || line === 0) return null
      const label = `MMS de ${num(ctx.params, 'period')} semanas`
      const reading = readPriceVsLine(close, line, `da ${label}`, ctx.precision)
      const weeks = liveWeeks(ctx.candles, ctx.data)
      const perWeek = weeks
        ? sma(
            weeks.map((w) => w.close),
            num(ctx.params, 'period'),
          )
        : []
      const facts = closingFacts(
        ctx,
        (w) => {
          const v = perWeek[w]
          return v === null || v === undefined ? null : { low: v, high: v }
        },
        `da ${label}`,
      )
      return { ...reading, detail: [reading.detail, ...facts].join(' ') }
    },
  }
}

/** Série do Preço Realizado: preço ÷ MVRV (o preço em que MVRV = 1). */
const realizedCache = new WeakMap<object, TimedSeries>()
function realizedPrice(data: ComputeContext): TimedSeries | null {
  const mvrv = data.external.BTC_MVRV
  const price = data.external.BTC_PRICE_CM
  if (!mvrv || !price) return null
  const cached = realizedCache.get(mvrv)
  if (cached) return cached
  const priceAt = new Map(price.points)
  const points: [number, number][] = []
  for (const [t, ratio] of mvrv.points) {
    const p = priceAt.get(t)
    if (p !== undefined && ratio > 0) points.push([t, p / ratio])
  }
  const series = { points, maxGapDays: Math.max(mvrv.maxGapDays, price.maxGapDays) }
  realizedCache.set(mvrv, series)
  return series
}

function lastDataDate(series: TimedSeries | undefined, at: number): string | null {
  if (!series) return null
  const i = lastIndexAtOrBefore(series.points, at)
  return i < 0 ? null : dateLabel(series.points[i]![0])
}

export const CYCLE_INDICATORS = {
  bmsb: {
    type: 'bmsb',
    name: 'Faixa de Bull Market',
    short: 'Faixa Bull',
    label: (p) => `Faixa Bull ${num(p, 'smaPeriod')}s/${num(p, 'emaPeriod')}s`,
    description: 'MMS de 20 semanas + MME de 21 semanas, com a área entre elas pintada.',
    pack: 'cycle',
    about: {
      what: 'Faixa entre a média simples de 20 semanas e a média exponencial de 21 semanas (semeada com a média das 21 primeiras semanas), calculada no semanal e mostrada em qualquer tempo gráfico.',
      howToRead:
        'Preço acima da faixa = estrutura de bull, e nela a faixa costuma funcionar como suporte. Fechar a semana abaixo dela costuma sinalizar começo de bear. Um fechamento mensal acima da faixa costuma confirmar a retomada.',
    },
    placement: 'overlay',
    requires: { weekly: true, monthly: true },
    params: [
      { key: 'smaPeriod', label: 'MMS (semanas)', kind: 'int', min: 2, max: 200, default: 20 },
      { key: 'emaPeriod', label: 'MME (semanas)', kind: 'int', min: 2, max: 200, default: 21 },
      { key: 'smaColor', label: 'Cor da MMS', kind: 'color', default: '#ef4444' },
      { key: 'emaColor', label: 'Cor da MME', kind: 'color', default: '#22c55e' },
      { key: 'fillColor', label: 'Cor da faixa', kind: 'color', default: '#f59e0b' },
    ],
    outputs: [
      {
        key: 'sma',
        label: 'MMS',
        style: 'line',
        colorParam: 'smaColor',
        fillTo: 'ema',
        fillColorParam: 'fillColor',
      },
      { key: 'ema', label: 'MME', style: 'line', colorParam: 'emaColor' },
    ],
    compute: (candles, p, data) => {
      const lines = weeklyLines(candles, data, (closes) => ({
        sma: sma(closes, num(p, 'smaPeriod')),
        ema: ema(closes, num(p, 'emaPeriod')),
      }))
      if (!lines) return { sma: nulls(candles.length), ema: nulls(candles.length) }
      return {
        sma: mapWeekly(lines.perWeek.sma!, lines.indexes),
        ema: mapWeekly(lines.perWeek.ema!, lines.indexes),
      }
    },
    read: (ctx): Reading | null => {
      const s = valueAt(ctx.outputs.sma, ctx.index)
      const e = valueAt(ctx.outputs.ema, ctx.index)
      const close = ctx.candles[ctx.index]?.close
      if (s === null || e === null || close === undefined) return null
      const low = Math.min(s, e)
      const high = Math.max(s, e)
      const side = sideOf(close, low, high)
      const lines = `MMS ${num(ctx.params, 'smaPeriod')}s ${fmt(s, ctx.precision)} · MME ${num(ctx.params, 'emaPeriod')}s ${fmt(e, ctx.precision)}`
      const position =
        side === 'acima'
          ? `Preço ${fmt((close / high - 1) * 100)}% acima do topo da faixa (${lines}).`
          : side === 'abaixo'
            ? `Preço ${fmt((1 - close / low) * 100)}% abaixo do fundo da faixa (${lines}).`
            : `Preço dentro da faixa (${lines}).`

      const weeks = liveWeeks(ctx.candles, ctx.data)
      const closes = weeks?.map((w) => w.close) ?? []
      const sw = sma(closes, num(ctx.params, 'smaPeriod'))
      const ew = ema(closes, num(ctx.params, 'emaPeriod'))
      const facts = closingFacts(
        ctx,
        (w) => {
          const a = sw[w]
          const b = ew[w]
          if (a === null || a === undefined || b === null || b === undefined) return null
          return { low: Math.min(a, b), high: Math.max(a, b) }
        },
        'da faixa',
      )
      return {
        value: `${fmt(low, ctx.precision)} – ${fmt(high, ctx.precision)}`,
        zone: `${side === 'dentro' ? 'dentro' : side} da faixa`,
        tone: side === 'acima' ? 'above' : side === 'abaixo' ? 'below' : 'middle',
        detail: [position, ...facts].join(' '),
      }
    },
  },

  sma50w: weeklySma(
    'sma50w',
    50,
    '#3b82f6',
    {
      what: 'Média simples dos fechamentos das últimas 50 semanas, calculada no semanal e mostrada em qualquer tempo gráfico.',
      howToRead:
        'Fechar a semana e romper a média de 50 semanas para cima costuma sinalizar reversão de ciclo; um reteste dela depois é comum.',
    },
    'Média de 50 semanas: rompimento semanal costuma marcar virada de ciclo.',
  ),

  sma200w: weeklySma(
    'sma200w',
    200,
    '#a855f7',
    {
      what: 'Média simples dos fechamentos das últimas 200 semanas (cerca de 4 anos, um ciclo do Bitcoin).',
      howToRead:
        'Costuma funcionar como o "chão" dos mercados de baixa: historicamente, os fundos de ciclo do BTC ficaram perto ou pouco abaixo dela.',
    },
    'Média de 200 semanas: o "chão" histórico dos bears.',
  ),

  mvrv: {
    type: 'mvrv',
    name: 'MVRV',
    short: 'MVRV',
    label: () => 'MVRV',
    description: 'Valor de mercado ÷ valor realizado do Bitcoin (on-chain).',
    pack: 'cycle',
    about: {
      what: 'Razão entre o valor de mercado do Bitcoin e o valor realizado (cada moeda avaliada pelo preço da última vez que se moveu). Dado diário da Coin Metrics; só para pares de BTC.',
      howToRead: `Abaixo de ${fmt(ZONES.mvrv.bottom, 1)} = zona de fundo; entre ${fmt(ZONES.mvrv.accumulationLow, 1)} e ${fmt(ZONES.mvrv.accumulationHigh, 1)} = acumulação; acima de ${fmt(ZONES.mvrv.top, 1)} = zona de topo.`,
    },
    placement: 'pane',
    digits: 2,
    usesPrice: false,
    requires: { external: ['BTC_MVRV'] },
    params: [{ key: 'color', label: 'Cor', kind: 'color', default: '#f97316' }],
    outputs: [{ key: 'value', label: 'MVRV', style: 'line', colorParam: 'color' }],
    levels: () => [ZONES.mvrv.bottom, ZONES.mvrv.accumulationHigh, ZONES.mvrv.top],
    compute: (candles, _p, data) => {
      const series = data.external.BTC_MVRV
      if (!series || !isBtc(data.symbol)) return { value: nulls(candles.length) }
      return { value: alignToCandles(series, candles, data) }
    },
    read: (ctx): Reading | null => {
      const v = valueAt(ctx.outputs.value, ctx.index)
      if (v === null) return null
      const z = ZONES.mvrv
      const [zone, tone] =
        v < z.bottom
          ? (['fundo', 'bottom'] as const)
          : v >= z.top
            ? (['topo', 'top'] as const)
            : v >= z.accumulationLow && v <= z.accumulationHigh
              ? (['acumulação', 'middle'] as const)
              : (['meio', 'middle'] as const)
      const date = lastDataDate(ctx.data.external.BTC_MVRV, ctx.data.now)
      return {
        value: fmt(v),
        zone,
        tone,
        detail: `Abaixo de ${fmt(z.bottom, 1)} = fundo; ${fmt(z.accumulationLow, 1)} a ${fmt(z.accumulationHigh, 1)} = acumulação; acima de ${fmt(z.top, 1)} = topo.${date ? ` Último dado: ${date} (Coin Metrics).` : ''}`,
      }
    },
  },

  realized: {
    type: 'realized',
    name: 'Preço Realizado',
    short: 'Preço Realizado',
    label: () => 'Preço Realizado',
    description: 'Preço em que o MVRV é 1 (custo médio on-chain do BTC).',
    pack: 'cycle',
    about: {
      what: 'Preço médio pelo qual as moedas em circulação se moveram pela última vez (valor realizado ÷ oferta). É o preço em que o MVRV vale 1. Dado diário da Coin Metrics; só para pares de BTC.',
      howToRead:
        'Preço abaixo do Preço Realizado equivale a MVRV abaixo de 1: historicamente, zona de fundo de ciclo.',
    },
    placement: 'overlay',
    usesPrice: false,
    requires: { external: ['BTC_MVRV', 'BTC_PRICE_CM'] },
    params: [{ key: 'color', label: 'Cor', kind: 'color', default: '#f97316' }],
    outputs: [{ key: 'value', label: 'Preço Realizado', style: 'line', colorParam: 'color' }],
    compute: (candles, _p, data) => {
      const series = isBtc(data.symbol) ? realizedPrice(data) : null
      if (!series) return { value: nulls(candles.length) }
      return { value: alignToCandles(series, candles, data) }
    },
    read: (ctx): Reading | null => {
      const line = valueAt(ctx.outputs.value, ctx.index)
      const close = ctx.candles[ctx.index]?.close
      if (line === null || close === undefined || line === 0) return null
      const reading = readPriceVsLine(close, line, 'do Preço Realizado (MVRV = 1)', ctx.precision)
      const date = lastDataDate(realizedPrice(ctx.data) ?? undefined, ctx.data.now)
      return { ...reading, detail: `${reading.detail}${date ? ` Último dado: ${date}.` : ''}` }
    },
  },
} satisfies Record<string, IndicatorDef>
