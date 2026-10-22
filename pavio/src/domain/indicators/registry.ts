import type { Candle } from '../types'
import { bollinger, ema, macd, rsi, sma, type Series } from './math'
import { PRICE_SOURCES, isPriceSource, sourceValues, type PriceSource } from './source'

export type IndicatorType = 'ema' | 'sma' | 'bb' | 'rsi' | 'macd'

/** Valores de parâmetros: números, fonte de preço ou cor (#rrggbb). */
export type ParamValue = number | string
export type IndicatorParams = Record<string, ParamValue>

export type ParamDef =
  | { key: string; label: string; kind: 'int'; min: number; max: number; default: number }
  | {
      key: string
      label: string
      kind: 'float'
      min: number
      max: number
      step: number
      default: number
    }
  | { key: string; label: string; kind: 'source'; default: PriceSource }
  | { key: string; label: string; kind: 'color'; default: string }

export type OutputStyle = 'line' | 'histogram'

export interface OutputDef {
  key: string
  label: string
  style: OutputStyle
  /** Parâmetro de cor que pinta esta saída (histogramas usam as cores de alta/baixa). */
  colorParam?: string
}

export interface IndicatorDef {
  type: IndicatorType
  name: string
  short: string
  description: string
  /** `overlay` desenha sobre os candles; `pane` cria um painel próprio abaixo. */
  placement: 'overlay' | 'pane'
  params: ParamDef[]
  outputs: OutputDef[]
  /** Linhas de referência horizontais (ex.: 70/30 no IFR). */
  levels?: { value: number; label: string }[]
  /** Escala fixa do painel. */
  range?: { min: number; max: number }
  compute: (candles: readonly Candle[], params: IndicatorParams) => Record<string, Series>
}

const num = (params: IndicatorParams, key: string) => params[key] as number
const src = (params: IndicatorParams) => params.source as PriceSource

export const INDICATORS: Record<IndicatorType, IndicatorDef> = {
  ema: {
    type: 'ema',
    name: 'Média Móvel Exponencial',
    short: 'MME',
    description: 'Média que dá mais peso aos preços recentes.',
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
    compute: (candles, p) => ({ value: rsi(sourceValues(candles, src(p)), num(p, 'period')) }),
  },
  macd: {
    type: 'macd',
    name: 'MACD',
    short: 'MACD',
    description: 'Convergência/divergência de médias móveis exponenciais.',
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
  const numeric = def.params
    .filter((p) => (p.kind === 'int' || p.kind === 'float') && !p.key.endsWith('Level'))
    .map((p) => String(params[p.key]).replace('.', ','))
  const source =
    params.source !== 'close' ? PRICE_SOURCES.find((s) => s.id === params.source) : null
  return [def.short, ...numeric, source ? source.label : null].filter(Boolean).join(' ')
}

export interface IndicatorConfig {
  id: string
  type: IndicatorType
  params: IndicatorParams
  visible: boolean
}

export interface IndicatorResult {
  config: IndicatorConfig
  outputs: Record<string, Series>
}

export function computeIndicator(
  config: IndicatorConfig,
  candles: readonly Candle[],
): IndicatorResult {
  return { config, outputs: INDICATORS[config.type].compute(candles, config.params) }
}
