import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeKlineEvent } from '../../tests/fixtures/klines'
import { FakeWebSocket } from '../../tests/helpers/fakeWebSocket'
import type { Candle } from '../domain/types'
import { BinanceStream } from '../services/binance/stream'
import { useKlines } from './useKlines'

const mocks = vi.hoisted(() => ({
  fetchKlines: vi.fn(),
  stream: null as unknown as BinanceStream,
}))

vi.mock('../services/binance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/binance')>()),
  fetchKlines: mocks.fetchKlines,
  getBinanceStream: () => mocks.stream,
}))

const c = (time: number, close = 100): Candle => ({
  time,
  open: 100,
  high: 110,
  low: 90,
  close,
  volume: 5,
})

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useKlines', () => {
  beforeEach(() => {
    FakeWebSocket.reset()
    mocks.fetchKlines.mockReset()
    mocks.stream = new BinanceStream({
      url: 'wss://example.test/stream',
      WebSocketImpl: FakeWebSocket as unknown as new (url: string) => WebSocket,
      initialBackoffMs: 10,
      random: () => 0.5,
    })
  })
  afterEach(() => mocks.stream.dispose())

  it('carrega histórico e aplica atualizações ao vivo', async () => {
    mocks.fetchKlines.mockResolvedValue([c(60), c(120)])
    const { result } = renderHook(() => useKlines('BTCUSDT', '1m'))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.candles).toHaveLength(2)

    const ws = FakeWebSocket.last()
    act(() => ws.open())
    act(() => ws.emit('btcusdt@kline_1m', makeKlineEvent('BTCUSDT', '1m', c(120, 105))))
    expect(result.current.candles[1]!.close).toBe(105)
    act(() => ws.emit('btcusdt@kline_1m', makeKlineEvent('BTCUSDT', '1m', c(180, 106))))
    expect(result.current.candles.map((x) => x.time)).toEqual([60, 120, 180])
  })

  it('guarda em buffer eventos que chegam antes do histórico', async () => {
    const history = deferred<Candle[]>()
    mocks.fetchKlines.mockReturnValue(history.promise)
    const { result } = renderHook(() => useKlines('BTCUSDT', '1m'))
    const ws = FakeWebSocket.last()
    act(() => ws.open())
    act(() => ws.emit('btcusdt@kline_1m', makeKlineEvent('BTCUSDT', '1m', c(180, 107))))
    expect(result.current.candles).toHaveLength(0)

    await act(async () => history.resolve([c(60), c(120)]))
    expect(result.current.candles.map((x) => [x.time, x.close])).toEqual([
      [60, 100],
      [120, 100],
      [180, 107],
    ])
  })

  it('troca de série não mostra dados antigos e ignora resposta atrasada', async () => {
    const slow = deferred<Candle[]>()
    mocks.fetchKlines.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([c(3600)])
    const { result, rerender } = renderHook(({ s }) => useKlines(s, '1h'), {
      initialProps: { s: 'BTCUSDT' },
    })
    rerender({ s: 'ETHUSDT' })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(async () => slow.resolve([c(1), c(2), c(3)]))
    expect(result.current.candles).toEqual([c(3600)])
    expect(mocks.fetchKlines.mock.calls[0]![0].signal.aborted).toBe(true)
  })

  it('expõe erro e permite tentar de novo', async () => {
    mocks.fetchKlines.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mocks.fetchKlines.mockResolvedValueOnce([c(60)])
    const { result } = renderHook(() => useKlines('BTCUSDT', '1m'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBeInstanceOf(TypeError)

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.candles).toEqual([c(60)])
  })

  it('recarrega o histórico após reconexão do WebSocket', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      mocks.fetchKlines
        .mockResolvedValueOnce([c(60)])
        .mockResolvedValueOnce([c(60), c(120), c(180)])
      const { result } = renderHook(() => useKlines('BTCUSDT', '1m'))
      await waitFor(() => expect(result.current.status).toBe('ready'))
      act(() => FakeWebSocket.last().open())

      act(() => FakeWebSocket.last().drop())
      await act(async () => vi.advanceTimersByTime(20))
      act(() => FakeWebSocket.last().open())

      await waitFor(() => expect(result.current.candles).toHaveLength(3))
      expect(mocks.fetchKlines).toHaveBeenCalledTimes(2)
      expect(result.current.status).toBe('ready')
    } finally {
      vi.useRealTimers()
    }
  })
})
