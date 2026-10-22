import type { Candle, IntervalId } from '../../domain/types'
import { binanceConfig } from './config'
import { parseRestKline } from './mappers'

export class BinanceApiError extends Error {
  readonly status: number
  readonly code: number | undefined

  constructor(message: string, status: number, code?: number) {
    super(message)
    this.name = 'BinanceApiError'
    this.status = status
    this.code = code
  }
}

export interface RestDeps {
  baseUrl?: string
  fetchImpl?: typeof fetch
}

async function getJson(
  path: string,
  params: Record<string, string>,
  signal: AbortSignal | undefined,
  deps: RestDeps,
) {
  const baseUrl = deps.baseUrl ?? binanceConfig.restUrl
  const fetchImpl = deps.fetchImpl ?? fetch
  const url = `${baseUrl}${path}?${new URLSearchParams(params).toString()}`
  const res = await fetchImpl(url, { signal })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = body as { code?: number; msg?: string } | null
    throw new BinanceApiError(err?.msg ?? `HTTP ${res.status}`, res.status, err?.code)
  }
  return body
}

/** Máximo de candles por pedido aceito pela Binance. */
export const KLINES_PAGE_SIZE = 1000

export interface FetchKlinesParams {
  symbol: string
  interval: IntervalId
  limit?: number
  /** Busca só candles abertos até este instante (ms), para carregar histórico antigo. */
  endTime?: number
  signal?: AbortSignal
}

export async function fetchKlines(
  { symbol, interval, limit = KLINES_PAGE_SIZE, endTime, signal }: FetchKlinesParams,
  deps: RestDeps = {},
): Promise<Candle[]> {
  const params: Record<string, string> = { symbol, interval, limit: String(limit) }
  if (endTime !== undefined) params.endTime = String(endTime)
  const body = await getJson('/api/v3/klines', params, signal, deps)
  if (!Array.isArray(body)) throw new BinanceApiError('Resposta inesperada da API', 200)
  return body.map(parseRestKline)
}
