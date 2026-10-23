import { formatPrice } from '../format'
import type { Series } from './math'
import { ZONES } from './zones'

/**
 * Leitura de um indicador no candle atual: só fatos (valor, zona e o que a zona
 * costuma significar), nunca recomendação de compra ou venda.
 *
 * Tons: `bottom`/`middle`/`top` para osciladores; `above`/`below` para posição do
 * preço em relação a uma linha; `loosening`/`tightening` para condições que
 * afrouxam ou apertam; `attention` para um fato que pede atenção sem direção
 * (ex.: bandas estreitas); `neutral` quando não há zona.
 */
export type ReadingTone =
  | 'bottom'
  | 'middle'
  | 'top'
  | 'above'
  | 'below'
  | 'loosening'
  | 'tightening'
  | 'attention'
  | 'neutral'

export interface Reading {
  /** Valor principal já formatado (pt-BR). */
  value: string
  /** Nome curto da zona, ex.: "topo", "acima". */
  zone: string
  tone: ReadingTone
  /** Frase com o contexto da zona. */
  detail: string
}

const fmt = (value: number, digits = 2) => formatPrice(value, digits)

/** Último valor não nulo da série no índice dado (ou null). */
export function valueAt(series: Series | undefined, index: number): number | null {
  const v = series?.[index]
  return v === undefined || v === null || !Number.isFinite(v) ? null : v
}

/** Oscilador com faixas de topo e fundo (ex.: IFR 70/30). */
export function readOscillator(value: number, lower: number, upper: number): Reading {
  if (value >= upper) {
    return {
      value: fmt(value),
      zone: 'topo',
      tone: 'top',
      detail: `Acima de ${fmt(upper, 0)}: zona de sobrecompra.`,
    }
  }
  if (value <= lower) {
    return {
      value: fmt(value),
      zone: 'fundo',
      tone: 'bottom',
      detail: `Abaixo de ${fmt(lower, 0)}: zona de sobrevenda.`,
    }
  }
  return {
    value: fmt(value),
    zone: 'meio',
    tone: 'middle',
    detail: `Entre ${fmt(lower, 0)} (sobrevenda) e ${fmt(upper, 0)} (sobrecompra).`,
  }
}

/**
 * Posição do preço em relação a uma linha (média móvel etc.). `ofLine` já traz
 * o artigo certo: "da MMS 50", "do Preço Realizado".
 */
export function readPriceVsLine(price: number, line: number, ofLine: string, precision: number) {
  const diff = (price / line - 1) * 100
  const above = diff >= 0
  return {
    value: fmt(line, precision),
    zone: above ? 'acima' : 'abaixo',
    tone: above ? 'above' : 'below',
    detail: `Preço ${fmt(Math.abs(diff))}% ${above ? 'acima' : 'abaixo'} ${ofLine}.`,
  } satisfies Reading
}

/**
 * Percentil (0–100) de `value` em `history`, contando empates pela metade:
 * uma série constante fica em 50 (nem estreita nem larga).
 */
export function percentileRank(value: number, history: readonly number[]): number {
  if (history.length === 0) return 50
  const below = history.filter((v) => v < value).length
  const equal = history.filter((v) => v === value).length
  return ((below + equal / 2) / history.length) * 100
}

/**
 * Bandas de Bollinger: posição do preço nas bandas e largura atual comparada
 * às últimas velas (bandas estreitas costumam anteceder movimentos fortes).
 */
export function readBollinger(
  close: number,
  upper: Series,
  middle: Series,
  lower: Series,
  index: number,
): Reading | null {
  const u = valueAt(upper, index)
  const m = valueAt(middle, index)
  const l = valueAt(lower, index)
  if (u === null || m === null || l === null || m === 0) return null

  const { widthLookback, narrowPercentile, widePercentile } = ZONES.bollinger
  const widths: number[] = []
  for (let i = Math.max(0, index - widthLookback + 1); i <= index; i++) {
    const ui = valueAt(upper, i)
    const mi = valueAt(middle, i)
    const li = valueAt(lower, i)
    if (ui !== null && mi !== null && li !== null && mi !== 0) widths.push((ui - li) / mi)
  }
  const width = (u - l) / m
  const rank = percentileRank(width, widths)
  const widthText =
    rank <= narrowPercentile
      ? `Bandas estreitas (largura entre as ${narrowPercentile}% menores das últimas ${widths.length} velas): historicamente, aperto costuma anteceder movimento forte.`
      : rank >= widePercentile
        ? `Bandas largas (largura entre as ${100 - widePercentile}% maiores das últimas ${widths.length} velas).`
        : `Largura das bandas na média das últimas ${widths.length} velas.`

  const percentB = u === l ? 0.5 : (close - l) / (u - l)
  const position =
    percentB > 1
      ? { zone: 'acima da banda', tone: 'top' as const, text: 'Preço acima da banda superior.' }
      : percentB < 0
        ? {
            zone: 'abaixo da banda',
            tone: 'bottom' as const,
            text: 'Preço abaixo da banda inferior.',
          }
        : {
            zone: 'dentro',
            tone: 'middle' as const,
            text: `Preço dentro das bandas (${fmt(percentB * 100, 0)}% do caminho da inferior à superior).`,
          }

  return {
    value: `largura ${fmt(width * 100)}%`,
    zone: rank <= narrowPercentile ? `${position.zone} · estreitas` : position.zone,
    tone: rank <= narrowPercentile ? 'attention' : position.tone,
    detail: `${position.text} ${widthText}`,
  }
}

/** MACD: posição em relação à linha de sinal e ao zero. */
export function readMacd(macd: number, signal: number): Reading {
  const vsSignal = macd >= signal ? 'acima' : 'abaixo'
  const vsZero = macd >= 0 ? 'acima' : 'abaixo'
  return {
    value: fmt(macd),
    zone: `${vsSignal} do sinal`,
    tone: macd >= signal ? 'above' : 'below',
    detail: `MACD ${vsSignal} da linha de sinal (histograma ${fmt(macd - signal)}) e ${vsZero} de zero.`,
  }
}
