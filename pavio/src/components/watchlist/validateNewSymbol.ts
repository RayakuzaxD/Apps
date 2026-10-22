import { isValidSymbol, normalizeSymbol } from '../../domain/symbols'
import {
  BinanceApiError,
  describeLoadError,
  explainLoadError,
  fetchTicker24h,
} from '../../services/binance'
import { MAX_WATCHLIST } from '../../store/watchlistStore'

/** Valida o par digitado (formato, duplicado, limite e existência na Binance). */
export async function validateNewSymbol(
  input: string,
  existing: readonly string[],
  check: (symbol: string) => Promise<unknown> = fetchTicker24h,
  explain: (error: unknown, symbol: string) => Promise<unknown> = explainLoadError,
): Promise<{ symbol: string } | { error: string }> {
  const symbol = normalizeSymbol(input)
  if (!isValidSymbol(symbol)) return { error: 'Use o formato do par, ex.: LINKUSDT.' }
  if (existing.includes(symbol)) return { error: `${symbol} já está na watchlist.` }
  if (existing.length >= MAX_WATCHLIST)
    return { error: `Limite de ${MAX_WATCHLIST} pares atingido.` }
  try {
    await check(symbol)
    return { symbol }
  } catch (raw) {
    const error = await explain(raw, symbol)
    if (error instanceof BinanceApiError && error.code === -1121) {
      return { error: `${symbol} não existe na Binance.` }
    }
    return { error: describeLoadError(error, symbol) }
  }
}
