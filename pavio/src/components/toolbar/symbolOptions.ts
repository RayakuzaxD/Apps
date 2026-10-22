import { POPULAR_SYMBOLS, isValidSymbol, normalizeSymbol } from '../../domain/symbols'

export interface Option {
  symbol: string
  custom: boolean
}

export function buildOptions(query: string): Option[] {
  const q = normalizeSymbol(query)
  const matches: Option[] = POPULAR_SYMBOLS.filter((s) => s.includes(q)).map((symbol) => ({
    symbol,
    custom: false,
  }))
  if (q && isValidSymbol(q) && !matches.some((o) => o.symbol === q)) {
    matches.unshift({ symbol: q, custom: true })
  }
  return matches
}
