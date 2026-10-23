import type { ExternalSeries } from '../../data/series'
import type { Candle, IntervalId } from '../types'
import type { Series } from './math'
import type { Reading } from './readings'
import type { PriceSource } from './source'

export type IndicatorType =
  | 'ema'
  | 'sma'
  | 'bb'
  | 'rsi'
  | 'macd'
  | 'bmsb'
  | 'sma50w'
  | 'sma200w'
  | 'mvrv'
  | 'realized'
  | 'gli'
  | 'nfci'

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

/** `hidden`: calculada (ex.: tendência que colore outra linha), mas não desenhada nem listada. */
export type OutputStyle = 'line' | 'histogram' | 'hidden'

export interface OutputDef {
  key: string
  label: string
  style: OutputStyle
  /** Parâmetro de cor que pinta esta saída (histogramas usam as cores de alta/baixa). */
  colorParam?: string
  /** Saída de tendência (1 sobe, -1 desce, 0 estável) que colore esta linha ponto a ponto. */
  trendKey?: string
  /** Preenche a área entre esta linha e a saída indicada (ex.: Faixa de Bull Market). */
  fillTo?: string
  /** Parâmetro de cor do preenchimento. */
  fillColorParam?: string
}

/** Pacotes temáticos em que os indicadores aparecem no menu. */
export type IndicatorPack = 'cycle' | 'macro' | 'general'

/** Dados além dos candles do gráfico que alguns indicadores usam. */
export interface ComputeContext {
  symbol: string
  interval: IntervalId
  intervalSeconds: number
  /** Agora, em segundos (vela em formação). */
  now: number
  /** Velas semanais do par, para indicadores em semanas fora do 1S (null: indisponível). */
  weekly: readonly Candle[] | null
  /** Velas mensais recentes do par, para o fechamento mensal (null: indisponível). */
  monthly: readonly Candle[] | null
  /** Séries macro/on-chain carregadas, por id. */
  external: Partial<Record<string, ExternalSeries>>
}

/** O que um indicador precisa além dos candles do gráfico. */
export interface IndicatorRequirements {
  weekly?: boolean
  monthly?: boolean
  external?: readonly string[]
}

/** Dados para a leitura do indicador num candle (normalmente o atual). */
export interface ReadingContext {
  candles: readonly Candle[]
  outputs: Record<string, Series>
  params: IndicatorParams
  index: number
  /** Casas decimais de preço do par. */
  precision: number
  data: ComputeContext
}

export interface IndicatorDef {
  type: IndicatorType
  name: string
  short: string
  /** Rótulo da instância (padrão: sigla + parâmetros numéricos). */
  label?: (params: IndicatorParams) => string
  description: string
  pack: IndicatorPack
  /** Texto curto exibido ao tocar no nome: o que é e como costuma ser lido. */
  about: { what: string; howToRead: string }
  /** Leitura do candle (valor, zona e contexto) ou null quando falta dado. */
  read: (ctx: ReadingContext) => Reading | null
  /** `overlay` desenha sobre os candles; `pane` cria um painel próprio abaixo. */
  placement: 'overlay' | 'pane'
  params: ParamDef[]
  outputs: OutputDef[]
  /** Linhas de referência horizontais (ex.: 70/30 no IFR). */
  levels?: (params: IndicatorParams) => number[]
  /** Escala fixa do painel. */
  range?: { min: number; max: number }
  /** Casas decimais dos valores (padrão: as do preço; 2 com escala fixa). */
  digits?: number
  /** Dados extras necessários (velas semanais/mensais, séries externas). */
  requires?: IndicatorRequirements
  /**
   * `false` quando o resultado só depende dos horários das velas (séries externas):
   * o cálculo é reaproveitado enquanto as velas não mudam de horário.
   */
  usesPrice?: boolean
  compute: (
    candles: readonly Candle[],
    params: IndicatorParams,
    data: ComputeContext,
  ) => Record<string, Series>
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
