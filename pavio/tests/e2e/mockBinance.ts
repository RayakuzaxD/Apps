import type { Page, Route, WebSocketRoute } from '@playwright/test'
import { makeRestKlines } from '../fixtures/klines'
import { makeTicker24h } from '../fixtures/tickers'

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

const START_PRICE: Record<string, number> = { BTCUSDT: 60_000, ETHUSDT: 3_000, SOLUSDT: 150 }

/** Ticker de 24h (último preço e abertura) dos pares conhecidos pelo mock. */
export const TICKERS: Record<string, { last: number; open: number }> = {
  BTCUSDT: { last: 61_234.5, open: 60_000 },
  ETHUSDT: { last: 2_940, open: 3_000 },
  BNBUSDT: { last: 590.12, open: 580 },
  SOLUSDT: { last: 150.5, open: 150.5 },
  XRPUSDT: { last: 0.5123, open: 0.5 },
  DOGEUSDT: { last: 0.12345, open: 0.13 },
  LINKUSDT: { last: 14.567, open: 14 },
}

export const KLINE_COUNT = 300
export const START_MS = Date.UTC(2026, 8, 1)

export function fixtureKlines(symbol: string, interval: string) {
  return makeRestKlines(KLINE_COUNT, {
    startMs: START_MS,
    intervalMs: INTERVAL_MS[interval] ?? 3_600_000,
    startPrice: START_PRICE[symbol] ?? 1,
    seed: symbol.length * 7 + interval.length,
  })
}

export interface BinanceMock {
  klineRequests: { symbol: string; interval: string }[]
  wsMessages: { method: string; params: string[] }[]
  tickerRequests: string[]
  ws: () => WebSocketRoute
  sendKline: (stream: string, data: unknown) => void
  /** Envia uma mensagem de qualquer stream combinado. */
  send: (stream: string, data: unknown) => void
}

/**
 * A Binance responde 400 "Invalid symbol" sem cabeçalhos CORS, então no navegador
 * a requisição falha como erro de rede. O mock reproduz isso abortando o pedido.
 */
function failLikeBinance(route: Route) {
  return route.abort('failed')
}

/** Intercepta REST e WebSocket da Binance com dados determinísticos. */
export async function mockBinance(page: Page): Promise<BinanceMock> {
  const klineRequests: BinanceMock['klineRequests'] = []
  const wsMessages: BinanceMock['wsMessages'] = []
  const tickerRequests: string[] = []
  let socket: WebSocketRoute | null = null

  await page.route('**/api/v3/klines?**', async (route) => {
    const url = new URL(route.request().url())
    const symbol = url.searchParams.get('symbol') ?? ''
    const interval = url.searchParams.get('interval') ?? ''
    klineRequests.push({ symbol, interval })
    if (!START_PRICE[symbol]) {
      await failLikeBinance(route)
      return
    }
    await route.fulfill({ json: fixtureKlines(symbol, interval) })
  })

  await page.route('**/api/v3/ticker/24hr?**', async (route) => {
    const symbol = new URL(route.request().url()).searchParams.get('symbol') ?? ''
    tickerRequests.push(symbol)
    const t = TICKERS[symbol]
    if (!t) {
      await failLikeBinance(route)
      return
    }
    await route.fulfill({ json: makeTicker24h(symbol, t.last, t.open) })
  })

  await page.route('**/api/v3/ticker/price', async (route) => {
    const known = new Set([...Object.keys(START_PRICE), ...Object.keys(TICKERS)])
    await route.fulfill({
      json: [...known].map((symbol) => ({ symbol, price: '1' })),
      headers: { 'access-control-allow-origin': '*' },
    })
  })

  await page.routeWebSocket(/\/stream$/, (ws) => {
    socket = ws
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw)) as { method: string; params: string[]; id: number }
      wsMessages.push({ method: msg.method, params: msg.params })
      ws.send(JSON.stringify({ result: null, id: msg.id }))
    })
  })

  const send = (stream: string, data: unknown) => {
    if (!socket) throw new Error('WebSocket ainda não conectou')
    socket.send(JSON.stringify({ stream, data }))
  }

  return {
    klineRequests,
    wsMessages,
    tickerRequests,
    ws: () => {
      if (!socket) throw new Error('WebSocket ainda não conectou')
      return socket
    },
    sendKline: send,
    send,
  }
}
