import { describe, expect, it, vi } from 'vitest'
import { fetchBitstampDailyBefore } from '.'

const DAY = 86_400

function row(time: number, close = 100) {
  const s = String(close)
  return { timestamp: String(time), open: s, high: s, low: s, close: s, volume: '2.5' }
}

/** Simula a Bitstamp: dias de `first` a `last`; `end` inclusivo, `limit` mais recentes. */
function fakeBitstamp(first: number, last: number) {
  return vi.fn(async (url: URL | RequestInfo) => {
    const params = new URL(String(url)).searchParams
    const end = Number(params.get('end'))
    const limit = Number(params.get('limit'))
    const rows = []
    for (let t = first; t <= Math.min(end, last); t += DAY) rows.push(row(t))
    return new Response(JSON.stringify({ data: { pair: 'BTC/USD', ohlc: rows.slice(-limit) } }))
  })
}

describe('fetchBitstampDailyBefore', () => {
  it('busca de trás para frente até o início, só antes de `before`', async () => {
    const first = 1_000 * DAY
    const before = first + 2_500 * DAY
    const fetchImpl = fakeBitstamp(first, first + 3_000 * DAY)
    const candles = await fetchBitstampDailyBefore(before, undefined, {
      baseUrl: 'https://bitstamp.test',
      fetchImpl,
    })
    expect(candles).toHaveLength(2_500)
    expect(candles[0]).toEqual({
      time: first,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 2.5,
    })
    expect(candles.at(-1)!.time).toBe(before - DAY)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      `https://bitstamp.test/api/v2/ohlc/btcusd/?step=86400&limit=1000&end=${before - 1}`,
    )
  })

  it('sem dados antes de `before` devolve lista vazia', async () => {
    const fetchImpl = fakeBitstamp(5_000 * DAY, 6_000 * DAY)
    expect(await fetchBitstampDailyBefore(100 * DAY, undefined, { fetchImpl })).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('propaga erro HTTP e resposta fora do formato', async () => {
    const http = vi.fn(async () => new Response('', { status: 503 }))
    await expect(fetchBitstampDailyBefore(DAY, undefined, { fetchImpl: http })).rejects.toThrow(
      'HTTP 503',
    )
    const weird = vi.fn(async () => new Response(JSON.stringify({ data: {} })))
    await expect(fetchBitstampDailyBefore(DAY, undefined, { fetchImpl: weird })).rejects.toThrow(
      'resposta inesperada',
    )
    const bad = vi.fn(
      async () => new Response(JSON.stringify({ data: { ohlc: [{ ...row(0), close: 'x' }] } })),
    )
    await expect(fetchBitstampDailyBefore(DAY, undefined, { fetchImpl: bad })).rejects.toThrow(
      'formato inesperado',
    )
  })
})
