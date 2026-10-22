import type { Candle } from '../../domain/types'

/** API pública da Bitstamp: BTC/USD diário desde agosto de 2011, com CORS liberado. */
export const BITSTAMP_REST_URL = 'https://www.bitstamp.net'

const PAGE_SIZE = 1000
/** ~2700 dias até a Binance começar (ago/2017): 3 páginas bastam; o limite evita laço infinito. */
const MAX_PAGES = 8

export interface BitstampDeps {
  baseUrl?: string
  fetchImpl?: typeof fetch
}

interface BitstampRow {
  timestamp: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

function toCandle(row: BitstampRow): Candle {
  const candle = {
    time: Number(row.timestamp),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  }
  if (Object.values(candle).some((v) => !Number.isFinite(v))) {
    throw new Error('Candle da Bitstamp em formato inesperado')
  }
  return candle
}

/**
 * Todos os candles diários de BTC/USD da Bitstamp abertos antes de `before`
 * (segundos UTC), em ordem. Busca de trás para frente, 1000 dias por pedido.
 */
export async function fetchBitstampDailyBefore(
  before: number,
  signal: AbortSignal | undefined,
  deps: BitstampDeps = {},
): Promise<Candle[]> {
  const baseUrl = deps.baseUrl ?? BITSTAMP_REST_URL
  const fetchImpl = deps.fetchImpl ?? fetch
  let end = before - 1
  let result: Candle[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      step: '86400',
      limit: String(PAGE_SIZE),
      end: String(end),
    })
    const res = await fetchImpl(`${baseUrl}/api/v2/ohlc/btcusd/?${params.toString()}`, { signal })
    if (!res.ok) throw new Error(`Bitstamp: HTTP ${res.status}`)
    const body = (await res.json()) as { data?: { ohlc?: BitstampRow[] } }
    const rows = body.data?.ohlc
    if (!Array.isArray(rows)) throw new Error('Bitstamp: resposta inesperada')
    const candles = rows.map(toCandle).filter((c) => c.time < before && c.time <= end)
    if (candles.length === 0) break
    result = [...candles, ...result]
    end = candles[0]!.time - 1
    if (rows.length < PAGE_SIZE) break
  }
  return result
}
