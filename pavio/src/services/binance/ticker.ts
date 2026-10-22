import { binanceConfig } from './config'
import { BinanceApiError, type RestDeps } from './rest'

/** Preço atual e abertura da janela móvel de 24h. */
export interface TickerSnapshot {
  symbol: string
  price: number
  open: number
}

function num(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(`Valor numérico inválido: ${String(value)}`)
  return n
}

/** Resposta de /api/v3/ticker/24hr?symbol=X. */
export function parseTicker24h(body: unknown): TickerSnapshot {
  if (typeof body !== 'object' || body === null) throw new Error('Ticker em formato inesperado')
  const t = body as Record<string, unknown>
  return { symbol: String(t.symbol), price: num(t.lastPrice), open: num(t.openPrice) }
}

/** Evento do stream `<symbol>@miniTicker`. Retorna null para outras mensagens. */
export function parseMiniTicker(data: unknown): TickerSnapshot | null {
  if (typeof data !== 'object' || data === null) return null
  const t = data as Record<string, unknown>
  if (t.e !== '24hrMiniTicker') return null
  return { symbol: String(t.s), price: num(t.c), open: num(t.o) }
}

export function miniTickerStreamName(symbol: string): string {
  return `${symbol.toLowerCase()}@miniTicker`
}

/** Variação de 24h em fração (0.0123 = +1,23%). */
export function changeRatio(t: Pick<TickerSnapshot, 'price' | 'open'>): number {
  return t.open === 0 ? 0 : (t.price - t.open) / t.open
}

export async function fetchTicker24h(
  symbol: string,
  signal?: AbortSignal,
  deps: RestDeps = {},
): Promise<TickerSnapshot> {
  const baseUrl = deps.baseUrl ?? binanceConfig.restUrl
  const fetchImpl = deps.fetchImpl ?? fetch
  const url = `${baseUrl}/api/v3/ticker/24hr?${new URLSearchParams({ symbol }).toString()}`
  const res = await fetchImpl(url, { signal })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = body as { code?: number; msg?: string } | null
    throw new BinanceApiError(err?.msg ?? `HTTP ${res.status}`, res.status, err?.code)
  }
  return parseTicker24h(body)
}
