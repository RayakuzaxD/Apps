const DEFAULT_REST_URL = 'https://data-api.binance.vision'
const DEFAULT_WS_URL = 'wss://data-stream.binance.vision'

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export interface BinanceConfig {
  restUrl: string
  wsUrl: string
}

export function resolveBinanceConfig(env: Partial<Record<string, string>>): BinanceConfig {
  return {
    restUrl: stripTrailingSlash(env.VITE_BINANCE_REST_URL || DEFAULT_REST_URL),
    wsUrl: stripTrailingSlash(env.VITE_BINANCE_WS_URL || DEFAULT_WS_URL),
  }
}

export const binanceConfig = resolveBinanceConfig(import.meta.env)
