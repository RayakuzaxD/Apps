import type { IntervalId } from '../../domain/types'

interface PeriodWords {
  noun: string
  /** Substantivo feminino (concordância: "da semana fechada" × "do dia fechado"). */
  feminine: boolean
}

const PERIODS: Partial<Record<IntervalId, PeriodWords>> = {
  '1d': { noun: 'dia', feminine: false },
  '1w': { noun: 'semana', feminine: true },
  '1M': { noun: 'mês', feminine: false },
}
const CANDLE: PeriodWords = { noun: 'vela', feminine: true }

/** Frases do período com a concordância certa. */
export function periodPhrases(interval: IntervalId, forming: boolean) {
  const { noun, feminine } = PERIODS[interval] ?? CANDLE
  const of = feminine ? 'da' : 'do'
  const closed = feminine ? 'fechada' : 'fechado'
  const state = forming ? `${noun} em formação` : `${noun} ${closed}`
  return {
    status: state.charAt(0).toUpperCase() + state.slice(1),
    sinceOpen: `Variação desde a abertura ${of} ${noun}.`,
    scope: forming
      ? `${of} ${noun} em formação`
      : `${feminine ? 'da última' : 'do último'} ${noun} ${closed}`,
  }
}
