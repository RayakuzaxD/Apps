import { describe, expect, it } from 'vitest'
import { resolveBinanceConfig } from './config'

describe('resolveBinanceConfig', () => {
  it('usa o espelho binance.vision por padrão', () => {
    expect(resolveBinanceConfig({})).toEqual({
      restUrl: 'https://data-api.binance.vision',
      wsUrl: 'wss://data-stream.binance.vision',
    })
  })

  it('aceita endpoints customizados e remove a barra final', () => {
    expect(
      resolveBinanceConfig({
        VITE_BINANCE_REST_URL: 'https://api.binance.com/',
        VITE_BINANCE_WS_URL: 'wss://stream.binance.com:9443/',
      }),
    ).toEqual({
      restUrl: 'https://api.binance.com',
      wsUrl: 'wss://stream.binance.com:9443',
    })
  })
})
