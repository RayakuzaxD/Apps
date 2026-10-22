import { describe, expect, it, vi } from 'vitest'
import { makeRestKlines } from '../../../tests/fixtures/klines'
import { BinanceApiError, fetchKlines } from './rest'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchKlines', () => {
  it('monta a URL e converte a resposta', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(makeRestKlines(3)))
    const candles = await fetchKlines(
      { symbol: 'ETHUSDT', interval: '15m', limit: 3 },
      { baseUrl: 'https://example.test', fetchImpl },
    )
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/api/v3/klines?symbol=ETHUSDT&interval=15m&limit=3',
      expect.anything(),
    )
    expect(candles).toHaveLength(3)
    expect(candles[1]!.time - candles[0]!.time).toBe(3600)
  })

  it('propaga erro da Binance com código', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: -1121, msg: 'Invalid symbol.' }, 400))
    const promise = fetchKlines({ symbol: 'NOPEUSDT', interval: '1h' }, { fetchImpl })
    await expect(promise).rejects.toBeInstanceOf(BinanceApiError)
    await expect(promise).rejects.toMatchObject({ status: 400, code: -1121 })
  })

  it('lida com erro sem corpo JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response('bloqueado', { status: 451 }))
    await expect(
      fetchKlines({ symbol: 'BTCUSDT', interval: '1h' }, { fetchImpl }),
    ).rejects.toMatchObject({
      status: 451,
      message: 'HTTP 451',
    })
  })
})
