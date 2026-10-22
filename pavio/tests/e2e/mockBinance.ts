import type { Page, WebSocketRoute } from '@playwright/test'
import { makeRestKlines } from '../fixtures/klines'

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

const START_PRICE: Record<string, number> = { BTCUSDT: 60_000, ETHUSDT: 3_000, SOLUSDT: 150 }

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
  ws: () => WebSocketRoute
  sendKline: (stream: string, data: unknown) => void
}

/** Intercepta REST e WebSocket da Binance com dados determinísticos. */
export async function mockBinance(page: Page): Promise<BinanceMock> {
  const klineRequests: BinanceMock['klineRequests'] = []
  const wsMessages: BinanceMock['wsMessages'] = []
  let socket: WebSocketRoute | null = null

  await page.route('**/api/v3/klines?**', async (route) => {
    const url = new URL(route.request().url())
    const symbol = url.searchParams.get('symbol') ?? ''
    const interval = url.searchParams.get('interval') ?? ''
    klineRequests.push({ symbol, interval })
    if (!START_PRICE[symbol]) {
      await route.fulfill({ status: 400, json: { code: -1121, msg: 'Invalid symbol.' } })
      return
    }
    await route.fulfill({ json: fixtureKlines(symbol, interval) })
  })

  await page.routeWebSocket(/\/stream$/, (ws) => {
    socket = ws
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw)) as { method: string; params: string[]; id: number }
      wsMessages.push({ method: msg.method, params: msg.params })
      ws.send(JSON.stringify({ result: null, id: msg.id }))
    })
  })

  return {
    klineRequests,
    wsMessages,
    ws: () => {
      if (!socket) throw new Error('WebSocket ainda não conectou')
      return socket
    },
    sendKline: (stream, data) => {
      if (!socket) throw new Error('WebSocket ainda não conectou')
      socket.send(JSON.stringify({ stream, data }))
    },
  }
}
