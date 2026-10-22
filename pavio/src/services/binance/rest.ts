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

export interface FetchKlinesParams {
  symbol: string
  interval: IntervalId
  limit?: number
  signal?: AbortSignal
}

export async function fetchKlines(
  { symbol, interval, limit = 1000, signal }: FetchKlinesParams,
  deps: RestDeps = {},
): Promise<Candle[]> {
  const body = await getJson(
    '/api/v3/klines',
    { symbol, interval, limit: String(limit) },
    signal,
    deps,
  )
  if (!Array.isArray(body)) throw new BinanceApiError('Resposta inesperada da API', 200)
  return body.map(parseRestKline)
}
