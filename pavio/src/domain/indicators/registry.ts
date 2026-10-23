import type { Candle } from '../types'
import { bollinger, ema, macd, rsi, sma } from './math'
import {
  readBollinger,
  readMacd,
  readOscillator,
  readPriceVsLine,
  valueAt,
  type Reading,
} from './readings'
import { PRICE_SOURCES, isPriceSource, sourceValues, type PriceSource } from './source'
import { CYCLE_INDICATORS } from './cycle'
import { MACRO_INDICATORS } from './macro'

import type {
  ComputeContext,
  IndicatorConfig,
  IndicatorPack,
  IndicatorDef,
  IndicatorParams,
  IndicatorResult,
  IndicatorType,
  ParamDef,
  ParamValue,
  ReadingContext,
} from './types'

export type * from './types'

export const PACKS: readonly { id: IndicatorPack; name: string; description: string }[] = [
  {
    id: 'cycle',
    name: 'Ciclo & On-chain',
    description: 'Médias de ciclo, osciladores e dados da rede do Bitcoin.',
  },
  {
    id: 'macro',
    name: 'Macro & Liquidez',
    description: 'Liquidez global, juros, inflação e condições financeiras.',
  },
  { id: 'general', name: 'Gerais', description: 'Médias e osciladores clássicos.' },
]

const num = (params: IndicatorParams, key: string) => params[key] as number
const src = (params: IndicatorParams) => params.source as PriceSource

function readMovingAverage(ctx: ReadingContext, short: string): Reading | null {
  const line = valueAt(ctx.outputs.value, ctx.index)
  const close = ctx.candles[ctx.index]?.close
  if (line === null || close === undefined || line === 0) return null
  return readPriceVsLine(close, line, `da ${short} ${num(ctx.params, 'period')}`, ctx.precision)
}

export const INDICATORS: Record<IndicatorType, IndicatorDef> = {
  ema: {
    type: 'ema',
    name: 'Média Móvel Exponencial',
    short: 'MME',
    description: 'Média que dá mais peso aos preços recentes.',
    pack: 'general',
    about: {
      what: 'Média dos preços que dá mais peso aos mais recentes, por isso reage mais rápido que a média simples.',
      howToRead:
        'Preço acima da média indica tendência de alta no período; abaixo, de baixa. A média também costuma servir de suporte ou resistência.',
    },
    read: (ctx) => readMovingAverage(ctx, 'MME'),
    placement: 'overlay',
    params: [
      { key: 'period', label: 'Período', kind: 'int', min: 1, max: 500, default: 21 },
      { key: 'source', label: 'Fonte', kind: 'source', default: 'close' },
      { key: 'color', label: 'Cor', kind: 'color', default: '#3b82f6' },
    ],
    outputs: [{ key: 'value', label: 'MME', style: 'line', colorParam: 'color' }],
    compute: (candles, p) => ({ value: ema(sourceValues(candles, src(p)), num(p, 'period')) }),
  },
  sma: {
    type: 'sma',
    name: 'Média Móvel Simples',
    short: 'MMS',
    description: 'Média aritmética dos últimos N preços.',
    pack: 'general',
    about: {
      what: 'Média aritmética dos últimos N preços de fechamento.',
      howToRead:
        'Médias longas mostram a tendência principal: preço acima delas costuma marcar mercado de alta, e abaixo, de baixa. Também funcionam como suporte ou resistência.',
    },
    read: (ctx) => readMovingAverage(ctx, 'MMS'),
    placement: 'overlay',
    params: [
      { key: 'period', label: 'Período', kind: 'int', min: 1, max: 500, default: 50 },
      { key: 'source', label: 'Fonte', kind: 'source', default: 'close' },
      { key: 'color', label: 'Cor', kind: 'color', default: '#f59e0b' },
    ],
    outputs: [{ key: 'value', label: 'MMS', style: 'line', colorParam: 'color' }],
    compute: (candles, p) => ({ value: sma(sourceValues(candles, src(p)), num(p, 'period')) }),
  },
  bb: {
    type: 'bb',
    name: 'Bandas de Bollinger',
    short: 'BB',
    description: 'Média simples com bandas de desvio padrão acima e abaixo.',
    pack: 'cycle',
    about: {
      what: 'Média simples de 20 períodos com bandas a 2 desvios padrão acima e abaixo (padrão do TradingView).',
      howToRead:
        'As bandas se afastam quando a volatilidade sobe e se estreitam quando cai. Bandas estreitando costumam anteceder um evento de volatilidade grande, sem indicar a direção.',
    },
    read: (ctx) => {
      const close = ctx.candles[ctx.index]?.close
      if (close === undefined) return null
      const { upper, middle, lower } = ctx.outputs
      if (!upper || !middle || !lower) return null
      return readBollinger(close, upper, middle, lower, ctx.index)
    },
    placement: 'overlay',
    params: [
      { key: 'period', label: 'Período', kind: 'int', min: 2, max: 500, default: 20 },
      {
        key: 'multiplier',
        label: 'Desvios padrão',
        kind: 'float',
        min: 0.1,
        max: 10,
        step: 0.1,
        default: 2,
      },
      { key: 'source', label: 'Fonte', kind: 'source', default: 'close' },
      { key: 'middleColor', label: 'Cor da média', kind: 'color', default: '#a855f7' },
      { key: 'bandColor', label: 'Cor das bandas', kind: 'color', default: '#14b8a6' },
    ],
    outputs: [
      { key: 'upper', label: 'Superior', style: 'line', colorParam: 'bandColor' },
      { key: 'middle', label: 'Média', style: 'line', colorParam: 'middleColor' },
      { key: 'lower', label: 'Inferior', style: 'line', colorParam: 'bandColor' },
    ],
    compute: (candles, p) => {
      const { upper, middle, lower } = bollinger(
        sourceValues(candles, src(p)),
        num(p, 'period'),
        num(p, 'multiplier'),
      )
      return { upper, middle, lower }
    },
  },
  rsi: {
    type: 'rsi',
    name: 'Índice de Força Relativa',
    short: 'IFR',
    description: 'Oscilador de momento de 0 a 100 (RSI).',
    pack: 'cycle',
    about: {
      what: 'Oscilador de 0 a 100 que compara a força das altas com a das baixas recentes (14 períodos, padrão do TradingView).',
      howToRead:
        'Acima de 70, o ativo é considerado sobrecomprado; abaixo de 30, sobrevendido. Divergência entre o IFR e o preço pode antecipar mudança de direção.',
    },
    read: (ctx) => {
      const value = valueAt(ctx.outputs.value, ctx.index)
      if (value === null) return null
      return readOscillator(value, num(ctx.params, 'lowerLevel'), num(ctx.params, 'upperLevel'))
    },
    placement: 'pane',
    params: [
      { key: 'period', label: 'Período', kind: 'int', min: 2, max: 200, default: 14 },
      { key: 'source', label: 'Fonte', kind: 'source', default: 'close' },
      { key: 'upperLevel', label: 'Sobrecompra', kind: 'int', min: 50, max: 100, default: 70 },
      { key: 'lowerLevel', label: 'Sobrevenda', kind: 'int', min: 0, max: 50, default: 30 },
      { key: 'color', label: 'Cor', kind: 'color', default: '#a855f7' },
    ],
    outputs: [{ key: 'value', label: 'IFR', style: 'line', colorParam: 'color' }],
    range: { min: 0, max: 100 },
    levels: (p) => [num(p, 'upperLevel'), num(p, 'lowerLevel')],
    compute: (candles, p) => ({ value: rsi(sourceValues(candles, src(p)), num(p, 'period')) }),
  },
  macd: {
    type: 'macd',
    name: 'MACD',
    short: 'MACD',
    description: 'Convergência/divergência de médias móveis exponenciais.',
    pack: 'general',
    about: {
      what: 'Diferença entre duas médias exponenciais (12 e 26) e a média de 9 dessa diferença (linha de sinal).',
      howToRead:
        'MACD acima da linha de sinal indica momento de alta ganhando força; abaixo, de baixa. Acima de zero, a média curta está acima da longa.',
    },
    read: (ctx) => {
      const m = valueAt(ctx.outputs.macd, ctx.index)
      const s = valueAt(ctx.outputs.signal, ctx.index)
      return m === null || s === null ? null : readMacd(m, s)
    },
    placement: 'pane',
    params: [
      { key: 'fast', label: 'MME rápida', kind: 'int', min: 1, max: 200, default: 12 },
      { key: 'slow', label: 'MME lenta', kind: 'int', min: 2, max: 400, default: 26 },
      { key: 'signal', label: 'Sinal', kind: 'int', min: 1, max: 200, default: 9 },
      { key: 'source', label: 'Fonte', kind: 'source', default: 'close' },
      { key: 'macdColor', label: 'Cor do MACD', kind: 'color', default: '#3b82f6' },
      { key: 'signalColor', label: 'Cor do sinal', kind: 'color', default: '#f59e0b' },
    ],
    outputs: [
      { key: 'histogram', label: 'Histograma', style: 'histogram' },
      { key: 'macd', label: 'MACD', style: 'line', colorParam: 'macdColor' },
      { key: 'signal', label: 'Sinal', style: 'line', colorParam: 'signalColor' },
    ],
    compute: (candles, p) => {
      const result = macd(
        sourceValues(candles, src(p)),
        num(p, 'fast'),
        num(p, 'slow'),
        num(p, 'signal'),
      )
      return { histogram: result.histogram, macd: result.macd, signal: result.signal }
    },
  },
  ...CYCLE_INDICATORS,
  ...MACRO_INDICATORS,
}

export const INDICATOR_TYPES = Object.keys(INDICATORS) as IndicatorType[]

export function isIndicatorType(value: unknown): value is IndicatorType {
  return typeof value === 'string' && value in INDICATORS
}

export function defaultParams(type: IndicatorType): IndicatorParams {
  return Object.fromEntries(INDICATORS[type].params.map((p) => [p.key, p.default]))
}

/** Valida um parâmetro; retorna a mensagem de erro (pt-BR) ou null. */
export function validateParam(def: ParamDef, value: unknown): string | null {
  switch (def.kind) {
    case 'int':
    case 'float': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'Informe um número.'
      if (def.kind === 'int' && !Number.isInteger(value)) return 'Use um número inteiro.'
      if (value < def.min || value > def.max) return `Entre ${def.min} e ${def.max}.`
      return null
    }
    case 'source':
      return isPriceSource(value) ? null : 'Fonte inválida.'
    case 'color':
      return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? null : 'Cor inválida.'
  }
}

/** Regras que envolvem mais de um parâmetro. */
export function validateParams(
  type: IndicatorType,
  params: IndicatorParams,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const def of INDICATORS[type].params) {
    const error = validateParam(def, params[def.key])
    if (error) errors[def.key] = error
  }
  if (
    type === 'macd' &&
    !errors.fast &&
    !errors.slow &&
    num(params, 'fast') >= num(params, 'slow')
  ) {
    errors.slow = 'A MME lenta deve ser maior que a rápida.'
  }
  if (
    type === 'rsi' &&
    !errors.upperLevel &&
    !errors.lowerLevel &&
    num(params, 'lowerLevel') >= num(params, 'upperLevel')
  ) {
    errors.lowerLevel = 'Deve ser menor que a sobrecompra.'
  }
  return errors
}

/** Completa/corrige parâmetros (ex.: vindos do localStorage) com os padrões. */
export function sanitizeParams(type: IndicatorType, raw: unknown): IndicatorParams {
  const input = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const params = defaultParams(type)
  for (const def of INDICATORS[type].params) {
    const value = input[def.key]
    if (validateParam(def, value) === null) params[def.key] = value as ParamValue
  }
  return Object.keys(validateParams(type, params)).length === 0 ? params : defaultParams(type)
}

/** Rótulo curto da instância, ex.: "MME 21", "BB 20 2", "MACD 12 26 9". */
export function indicatorLabel(type: IndicatorType, params: IndicatorParams): string {
  const def = INDICATORS[type]
  if (def.label) return def.label(params)
  const numeric = def.params
    .filter((p) => (p.kind === 'int' || p.kind === 'float') && !p.key.endsWith('Level'))
    .map((p) => String(params[p.key]).replace('.', ','))
  const source =
    params.source !== 'close' ? PRICE_SOURCES.find((s) => s.id === params.source) : null
  return [def.short, ...numeric, source ? source.label : null].filter(Boolean).join(' ')
}

/**
 * Contexto mínimo (sem velas semanais/mensais nem séries externas): os
 * indicadores que dependem deles devolvem "sem dado".
 */
export function basicComputeContext(
  candles: readonly Candle[],
  overrides: Partial<ComputeContext> = {},
): ComputeContext {
  const last = candles[candles.length - 1]
  return {
    symbol: '',
    interval: '1d',
    intervalSeconds: 86_400,
    now: last ? last.time + 1 : 0,
    weekly: null,
    monthly: null,
    external: {},
    ...overrides,
  }
}

/** Leitura de um indicador calculado no candle `index` (padrão: o último). */
export function readIndicator(
  result: IndicatorResult,
  candles: readonly Candle[],
  precision: number,
  index = candles.length - 1,
  data: ComputeContext = basicComputeContext(candles),
): Reading | null {
  if (index < 0 || index >= candles.length) return null
  const { config, outputs } = result
  return INDICATORS[config.type].read({
    candles,
    outputs,
    params: config.params,
    index,
    precision,
    data,
  })
}

export function computeIndicator(
  config: IndicatorConfig,
  candles: readonly Candle[],
  data: ComputeContext = basicComputeContext(candles),
): IndicatorResult {
  return { config, outputs: INDICATORS[config.type].compute(candles, config.params, data) }
}
