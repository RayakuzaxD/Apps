import { binanceConfig } from './config'
import { BinanceApiError, type RestDeps } from './rest'

let cached: Promise<Set<string>> | null = null

/**
 * Todos os pares negociados na Binance (via /api/v3/ticker/price, que responde
 * com CORS). Carregado uma vez e mantido em cache; falhas não ficam em cache.
 */
export function fetchSymbolSet(deps: RestDeps = {}): Promise<Set<string>> {
  if (!cached) {
    const baseUrl = deps.baseUrl ?? binanceConfig.restUrl
    const fetchImpl = deps.fetchImpl ?? fetch
    cached = fetchImpl(`${baseUrl}/api/v3/ticker/price`)
      .then(async (res) => {
        if (!res.ok) throw new BinanceApiError(`HTTP ${res.status}`, res.status)
        const body: unknown = await res.json()
        if (!Array.isArray(body)) throw new Error('Lista de pares inesperada')
        return new Set(body.map((t) => String((t as { symbol?: unknown }).symbol)))
      })
      .catch((error: unknown) => {
        cached = null
        throw error
      })
  }
  return cached
}

/** Só para testes. */
export function resetSymbolSetCache() {
  cached = null
}

/**
 * As respostas de erro da Binance (ex.: 400 "Invalid symbol") vêm sem cabeçalhos
 * CORS, então o navegador as bloqueia e o fetch falha como erro de rede. Nesse
 * caso, consulta a lista de pares: se o par não existe, devolve o erro -1121
 * equivalente; senão, mantém o erro original (problema de conexão de verdade).
 */
export async function explainLoadError(
  error: unknown,
  symbol: string,
  deps: RestDeps = {},
): Promise<unknown> {
  if (!(error instanceof TypeError)) return error
  try {
    const symbols = await fetchSymbolSet(deps)
    return symbols.has(symbol) ? error : new BinanceApiError('Invalid symbol.', 400, -1121)
  } catch {
    return error
  }
}
