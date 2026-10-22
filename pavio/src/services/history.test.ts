import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Candle } from '../domain/types'
import { fetchHistoryPage, hasLongHistory } from './history'

const mocks = vi.hoisted(() => ({ fetchKlines: vi.fn(), fetchBitstampDailyBefore: vi.fn() }))

vi.mock('./binance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./binance')>()),
  fetchKlines: mocks.fetchKlines,
}))
vi.mock('./bitstamp', () => ({ fetchBitstampDailyBefore: mocks.fetchBitstampDailyBefore }))

const DAY = 86_400
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000
const c = (time: number, close = 1): Candle => ({
  time,
  open: 1,
  high: 2,
  low: 0.5,
  close,
  volume: 1,
})
const days = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => c(from + i * DAY))

describe('hasLongHistory', () => {
  it('só BTC/USDT em 1D, 1S e 1M', () => {
    expect(hasLongHistory('BTCUSDT', '1d')).toBe(true)
    expect(hasLongHistory('BTCUSDT', '1w')).toBe(true)
    expect(hasLongHistory('BTCUSDT', '1M')).toBe(true)
    expect(hasLongHistory('BTCUSDT', '4h')).toBe(false)
    expect(hasLongHistory('ETHUSDT', '1d')).toBe(false)
  })
})

describe('fetchHistoryPage', () => {
  beforeEach(() => {
    mocks.fetchKlines.mockReset()
    mocks.fetchBitstampDailyBefore.mockReset()
  })

  it('página cheia da Binance: há mais, sem consultar a Bitstamp', async () => {
    mocks.fetchKlines.mockResolvedValue(days(utc(2020, 1, 1), 1000))
    const page = await fetchHistoryPage({ symbol: 'BTCUSDT', interval: '1d' })
    expect(page.hasMore).toBe(true)
    expect(mocks.fetchBitstampDailyBefore).not.toHaveBeenCalled()
  })

  it('outros pares: página incompleta é o fim', async () => {
    mocks.fetchKlines.mockResolvedValue(days(utc(2020, 1, 1), 10))
    const page = await fetchHistoryPage({ symbol: 'ETHUSDT', interval: '1w' })
    expect(page).toEqual({ candles: days(utc(2020, 1, 1), 10), hasMore: false })
    expect(mocks.fetchBitstampDailyBefore).not.toHaveBeenCalled()
  })

  it('BTC semanal: completa com a Bitstamp agregada em semanas, mantendo a 1ª semana da Binance', async () => {
    // Binance começa na quinta 17/08/2017, dentro da semana de segunda 14/08.
    const binance = [c(utc(2017, 8, 14), 50), c(utc(2017, 8, 21), 60)]
    mocks.fetchKlines.mockResolvedValue(binance)
    mocks.fetchBitstampDailyBefore.mockResolvedValue(days(utc(2017, 8, 1), 16)) // 01 a 16/08
    const page = await fetchHistoryPage({ symbol: 'BTCUSDT', interval: '1w' })

    expect(mocks.fetchBitstampDailyBefore).toHaveBeenCalledWith(utc(2017, 8, 14), undefined)
    expect(page.hasMore).toBe(false)
    expect(page.candles.map((x) => x.time)).toEqual([
      utc(2017, 7, 31),
      utc(2017, 8, 7),
      utc(2017, 8, 14),
      utc(2017, 8, 21),
    ])
    expect(page.candles[0]!.volume).toBe(6) // 01 a 06/08
    expect(page.candles[2]!.close).toBe(50) // a semana parcial é a da Binance
  })

  it('BTC diário pedindo antes do início da Binance: usa só a Bitstamp, antes do endTime', async () => {
    mocks.fetchKlines.mockResolvedValue([])
    mocks.fetchBitstampDailyBefore.mockResolvedValue(days(utc(2017, 8, 10), 5))
    const endTime = utc(2017, 8, 15) * 1000 - 1
    const page = await fetchHistoryPage({ symbol: 'BTCUSDT', interval: '1d', endTime })
    expect(mocks.fetchBitstampDailyBefore).toHaveBeenCalledWith(utc(2017, 8, 15), undefined)
    expect(page).toEqual({ candles: days(utc(2017, 8, 10), 5), hasMore: false })
  })

  it('falha da Bitstamp com dados da Binance: mostra a Binance e deixa tentar de novo', async () => {
    mocks.fetchKlines.mockResolvedValue([c(utc(2017, 8, 14))])
    mocks.fetchBitstampDailyBefore.mockRejectedValue(new TypeError('Failed to fetch'))
    const page = await fetchHistoryPage({ symbol: 'BTCUSDT', interval: '1M' })
    expect(page).toEqual({ candles: [c(utc(2017, 8, 14))], hasMore: true })
  })

  it('falha da Bitstamp sem nada da Binance: propaga o erro', async () => {
    mocks.fetchKlines.mockResolvedValue([])
    mocks.fetchBitstampDailyBefore.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      fetchHistoryPage({ symbol: 'BTCUSDT', interval: '1d', endTime: 1_502_928_000_000 }),
    ).rejects.toThrow('Failed to fetch')
  })
})
