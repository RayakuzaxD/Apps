import {
  DAY,
  GLI_INPUTS,
  alignToCandles,
  changeOver,
  gliSeries,
  trendFromChange,
  type GliInputs,
  type TimedSeries,
} from '../external'
import { formatPrice } from '../format'
import type { Series } from './math'
import { valueAt, type Reading, type ReadingTone } from './readings'
import type { ComputeContext, IndicatorDef, IndicatorParams } from './types'
import { ZONES } from './zones'

const num = (params: IndicatorParams, key: string) => params[key] as number
const fmt = (value: number, digits = 2) => formatPrice(value, digits)
const signed = (value: number, digits = 2) => `${value > 0 ? '+' : ''}${fmt(value, digits)}`
const nulls = (n: number): Series => Array.from({ length: n }, () => null)

function dateLabel(time: number): string {
  return new Date(time * 1000).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/** Componentes do GLI carregados, ou null se faltar algum. */
function gliInputs(data: ComputeContext): GliInputs | null {
  const inputs: Partial<GliInputs> = {}
  for (const id of GLI_INPUTS) {
    const series = data.external[id]
    if (!series) return null
    inputs[id] = series
  }
  return inputs as GliInputs
}

function lastPointTime(series: TimedSeries): number | null {
  return series.points[series.points.length - 1]?.[0] ?? null
}

export const MACRO_INDICATORS = {
  gli: {
    type: 'gli',
    name: 'Índice de Liquidez Global',
    short: 'GLI',
    label: (p) => (num(p, 'offsetDays') > 0 ? `GLI +${num(p, 'offsetDays')}d` : 'GLI'),
    description: 'Liquidez dos bancos centrais (FED, BCE, Japão), em trilhões de US$.',
    pack: 'macro',
    about: {
      what: 'Soma da liquidez dos principais bancos centrais, em trilhões de US$: balanço do FED − conta do Tesouro (TGA) − recompra reversa (RRP) + balanço do BCE + balanço do Banco do Japão (convertidos pelo câmbio). A China não entra. Dados do FRED, atualizados 1× por dia.',
      howToRead:
        'O Bitcoin costuma andar com a liquidez: GLI subindo (verde) tende a acompanhar alta, e GLI caindo (vermelho) dificulta sustentar o preço. A liquidez costuma anteceder o preço; o offset desloca a linha para frente para comparar.',
    },
    placement: 'pane',
    digits: 2,
    usesPrice: false,
    requires: { external: GLI_INPUTS },
    params: [
      {
        key: 'offsetDays',
        label: 'Offset (dias à frente)',
        kind: 'int',
        min: 0,
        max: 365,
        default: 0,
      },
      {
        key: 'lookbackDays',
        label: 'Janela da tendência (dias)',
        kind: 'int',
        min: 7,
        max: 180,
        default: ZONES.gli.lookbackDays,
      },
    ],
    outputs: [
      { key: 'value', label: 'GLI (US$ tri)', style: 'line', trendKey: 'trend' },
      { key: 'trend', label: 'Tendência', style: 'hidden' },
      { key: 'change', label: 'Variação', style: 'hidden' },
    ],
    compute: (candles, p, data) => {
      const inputs = gliInputs(data)
      if (!inputs) {
        const empty = nulls(candles.length)
        return { value: empty, trend: empty, change: empty }
      }
      const series = gliSeries(inputs)
      const options = { ...data, offsetDays: num(p, 'offsetDays') }
      const change = changeOver(series, candles, options, num(p, 'lookbackDays'))
      return {
        value: alignToCandles(series, candles, options),
        trend: trendFromChange(change, 0),
        change,
      }
    },
    read: (ctx): Reading | null => {
      const v = valueAt(ctx.outputs.value, ctx.index)
      const change = valueAt(ctx.outputs.change, ctx.index)
      if (v === null) return null
      const lookback = num(ctx.params, 'lookbackDays')
      const offset = num(ctx.params, 'offsetDays')
      const [zone, tone]: [string, ReadingTone] =
        change === null || change === 0
          ? ['estável', 'neutral']
          : change > 0
            ? ['subindo', 'loosening']
            : ['caindo', 'tightening']
      const parts: string[] = []
      if (change !== null && v - change !== 0) {
        parts.push(`Variação de ${signed((change / (v - change)) * 100)}% em ${lookback} dias.`)
      }
      if (offset > 0) {
        const ahead = (ctx.outputs.value?.length ?? 0) - ctx.candles.length
        parts.push(
          `Deslocado ${offset} dias: o valor na vela atual é o de ${dateLabel(ctx.data.now - offset * DAY)}${ahead > 0 ? `, e a linha segue ${ahead} vela${ahead > 1 ? 's' : ''} à frente` : ''}.`,
        )
      }
      const inputs = gliInputs(ctx.data)
      const last = inputs ? lastPointTime(gliSeries(inputs)) : null
      if (last !== null) parts.push(`Último dado: ${dateLabel(last)}.`)
      return { value: `US$ ${fmt(v)} tri`, zone, tone, detail: parts.join(' ') }
    },
  },

  nfci: {
    type: 'nfci',
    name: 'Condições Financeiras (NFCI)',
    short: 'NFCI',
    label: () => 'NFCI',
    description: 'Índice de condições financeiras do FED de Chicago: o que importa é a direção.',
    pack: 'macro',
    about: {
      what: 'Índice semanal de condições financeiras do FED de Chicago (crédito, risco e alavancagem). Zero é a média histórica; negativo = condições mais frouxas que a média. Dado do FRED.',
      howToRead: `O que importa é a direção: afrouxar ${fmt(ZONES.nfci.threshold)} ou mais em ${ZONES.nfci.lookbackWeeks} semanas fica verde; apertar ${fmt(ZONES.nfci.threshold)} ou mais fica vermelho. NFCI apertando junto com a liquidez global caindo costuma pesar forte sobre o Bitcoin.`,
    },
    placement: 'pane',
    digits: 3,
    usesPrice: false,
    requires: { external: ['NFCI'] },
    params: [
      {
        key: 'lookbackWeeks',
        label: 'Janela (semanas)',
        kind: 'int',
        min: 1,
        max: 26,
        default: ZONES.nfci.lookbackWeeks,
      },
      {
        key: 'threshold',
        label: 'Limiar de mudança',
        kind: 'float',
        min: 0.01,
        max: 1,
        step: 0.01,
        default: ZONES.nfci.threshold,
      },
    ],
    outputs: [
      { key: 'value', label: 'NFCI', style: 'line', trendKey: 'trend' },
      { key: 'trend', label: 'Direção', style: 'hidden' },
      { key: 'change', label: 'Variação', style: 'hidden' },
    ],
    levels: () => [0],
    compute: (candles, p, data) => {
      const series = data.external.NFCI
      if (!series) {
        const empty = nulls(candles.length)
        return { value: empty, trend: empty, change: empty }
      }
      const change = changeOver(series, candles, data, num(p, 'lookbackWeeks') * 7)
      // NFCI caindo = afrouxando (verde, 1); subindo = apertando (vermelho, -1).
      const trend = trendFromChange(change, num(p, 'threshold')).map((t) =>
        t === null ? null : -t || 0,
      )
      return { value: alignToCandles(series, candles, data), trend, change }
    },
    read: (ctx): Reading | null => {
      const v = valueAt(ctx.outputs.value, ctx.index)
      if (v === null) return null
      const change = valueAt(ctx.outputs.change, ctx.index)
      const trend = valueAt(ctx.outputs.trend, ctx.index)
      const weeks = num(ctx.params, 'lookbackWeeks')
      const threshold = num(ctx.params, 'threshold')
      const [zone, tone]: [string, ReadingTone] =
        trend === 1
          ? ['afrouxando', 'loosening']
          : trend === -1
            ? ['apertando', 'tightening']
            : ['estável', 'neutral']
      const series = ctx.data.external.NFCI
      const last = series ? lastPointTime(series) : null
      const parts = [
        change === null
          ? `Sem a variação de ${weeks} semanas.`
          : `Variação de ${signed(change, 3)} em ${weeks} semanas (limiar ${fmt(threshold)}).`,
        v < 0
          ? 'Abaixo de zero: condições mais frouxas que a média histórica.'
          : 'Acima de zero: condições mais apertadas que a média histórica.',
      ]
      if (last !== null) parts.push(`Último dado: ${dateLabel(last)}.`)
      return { value: fmt(v, 3), zone, tone, detail: parts.join(' ') }
    },
  },
} satisfies Record<string, IndicatorDef>
