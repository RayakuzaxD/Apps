import { describe, expect, it, vi } from 'vitest'
import { makeMiniTicker, makeTicker24h } from '../../../tests/fixtures/tickers'
import { BinanceApiError } from './rest'
import {
  changeRatio,
  fetchTicker24h,
  miniTickerStreamName,
  parseMiniTicker,
  parseTicker24h,
} from './ticker'

describe('tickers', () => {
  it('lê o ticker de 24h da API REST', () => {
    expect(parseTicker24h(makeTicker24h('BTCUSDT', 101, 100))).toEqual({
      symbol: 'BTCUSDT',
      price: 101,
      open: 100,
    })
  })

  it('lê o evento miniTicker e ignora outras mensagens', () => {
    expect(parseMiniTicker(makeMiniTicker('ETHUSDT', 2950, 3000))).toEqual({
      symbol: 'ETHUSDT',
      price: 2950,
      open: 3000,
    })
    expect(parseMiniTicker({ e: 'kline' })).toBeNull()
    expect(parseMiniTicker(null)).toBeNull()
  })

  it('variação de 24h em fração', () => {
    expect(changeRatio({ price: 101, open: 100 })).toBeCloseTo(0.01, 10)
    expect(changeRatio({ price: 95, open: 100 })).toBeCloseTo(-0.05, 10)
    expect(changeRatio({ price: 1, open: 0 })).toBe(0)
  })

  it('nome do stream em minúsculas', () => {
    expect(miniTickerStreamName('SOLUSDT')).toBe('solusdt@miniTicker')
  })
})

describe('fetchTicker24h', () => {
  it('busca um par', async () => {
    const fetchImpl = vi.fn(async () => Response.json(makeTicker24h('SOLUSDT', 150, 140)))
    const t = await fetchTicker24h('SOLUSDT', undefined, { baseUrl: 'https://x.test', fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://x.test/api/v3/ticker/24hr?symbol=SOLUSDT',
      expect.anything(),
    )
    expect(t).toEqual({ symbol: 'SOLUSDT', price: 150, open: 140 })
  })

  it('propaga par inexistente como BinanceApiError', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ code: -1121, msg: 'Invalid symbol.' }, { status: 400 }),
    )
    const promise = fetchTicker24h('NOPEUSDT', undefined, { fetchImpl })
    await expect(promise).rejects.toBeInstanceOf(BinanceApiError)
    await expect(promise).rejects.toMatchObject({ code: -1121 })
  })
})
