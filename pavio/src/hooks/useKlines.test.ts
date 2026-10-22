import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeKlineEvent } from '../../tests/fixtures/klines'
import { FakeWebSocket } from '../../tests/helpers/fakeWebSocket'
import type { Candle } from '../domain/types'
import { BinanceStream } from '../services/binance/stream'
import { MAX_CANDLES, useKlines } from './useKlines'

const mocks = vi.hoisted(() => ({
  fetchKlines: vi.fn(),
  explainLoadError: vi.fn(async (error: unknown) => error),
  stream: null as unknown as BinanceStream,
}))

vi.mock('../services/binance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/binance')>()),
  fetchKlines: mocks.fetchKlines,
  explainLoadError: mocks.explainLoadError,
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

/** `count` candles de 1m terminando em `lastTime` (inclusive). */
const series = (lastTime: number, count: number): Candle[] =>
  Array.from({ length: count }, (_, i) => c(lastTime - (count - 1 - i) * 60))

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

  it('usa o erro explicado (ex.: par inexistente com resposta bloqueada por CORS)', async () => {
    const network = new TypeError('Failed to fetch')
    const invalid = new Error('par inválido')
    mocks.fetchKlines.mockRejectedValueOnce(network)
    mocks.explainLoadError.mockResolvedValueOnce(invalid)
    const { result } = renderHook(() => useKlines('NOPEUSDT', '1m'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mocks.explainLoadError).toHaveBeenCalledWith(network, 'NOPEUSDT')
    expect(result.current.error).toBe(invalid)
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

  describe('histórico anterior', () => {
    const START = 1_000_000 * 60

    async function ready(history: Candle[]) {
      mocks.fetchKlines.mockResolvedValueOnce(history)
      const hook = renderHook(({ s }) => useKlines(s, '1m'), { initialProps: { s: 'BTCUSDT' } })
      await waitFor(() => expect(hook.result.current.status).toBe('ready'))
      return hook
    }

    it('busca candles anteriores ao primeiro e junta ao início', async () => {
      const { result } = await ready(series(START, 1000))
      expect(result.current.older).toBe('idle')

      mocks.fetchKlines.mockResolvedValueOnce(series(START - 1000 * 60, 1000))
      act(() => result.current.loadOlder())
      expect(result.current.older).toBe('loading')
      await waitFor(() => expect(result.current.older).toBe('idle'))

      const first = START - 999 * 60
      expect(mocks.fetchKlines.mock.calls[1]![0]).toMatchObject({
        symbol: 'BTCUSDT',
        interval: '1m',
        endTime: first * 1000 - 1,
      })
      expect(result.current.candles).toHaveLength(2000)
      expect(result.current.candles[999]!.time).toBe(first - 60)
      expect(result.current.candles[1000]!.time).toBe(first)
    })

    it('ignora pedidos repetidos enquanto carrega', async () => {
      const { result } = await ready(series(START, 1000))
      const older = deferred<Candle[]>()
      mocks.fetchKlines.mockReturnValueOnce(older.promise)
      act(() => result.current.loadOlder())
      act(() => result.current.loadOlder())
      expect(mocks.fetchKlines).toHaveBeenCalledTimes(2)
      await act(async () => older.resolve(series(START - 1000 * 60, 1000)))
    })

    it('marca o início do histórico quando a Binance devolve menos que uma página', async () => {
      const { result } = await ready(series(START, 1000))
      mocks.fetchKlines.mockResolvedValueOnce(series(START - 1000 * 60, 10))
      act(() => result.current.loadOlder())
      await waitFor(() => expect(result.current.older).toBe('end'))
      expect(result.current.candles).toHaveLength(1010)

      act(() => result.current.loadOlder())
      expect(mocks.fetchKlines).toHaveBeenCalledTimes(2)
    })

    it('histórico inicial curto já é o início do par', async () => {
      const { result } = await ready(series(START, 50))
      expect(result.current.older).toBe('end')
      act(() => result.current.loadOlder())
      expect(mocks.fetchKlines).toHaveBeenCalledTimes(1)
    })

    it('em falha, só tenta de novo com retryOlder', async () => {
      const { result } = await ready(series(START, 1000))
      mocks.fetchKlines.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      act(() => result.current.loadOlder())
      await waitFor(() => expect(result.current.older).toBe('error'))
      expect(result.current.status).toBe('ready')
      expect(result.current.candles).toHaveLength(1000)

      act(() => result.current.loadOlder())
      expect(mocks.fetchKlines).toHaveBeenCalledTimes(2)

      mocks.fetchKlines.mockResolvedValueOnce(series(START - 1000 * 60, 1000))
      act(() => result.current.retryOlder())
      await waitFor(() => expect(result.current.older).toBe('idle'))
      expect(result.current.candles).toHaveLength(2000)
    })

    it('para no limite de candles por série', async () => {
      const { result } = await ready(series(START, 1000))
      for (let page = 1; page < MAX_CANDLES / 1000; page++) {
        mocks.fetchKlines.mockResolvedValueOnce(series(START - page * 1000 * 60, 1000))
        act(() => result.current.loadOlder())
        await waitFor(() => expect(result.current.candles).toHaveLength((page + 1) * 1000))
      }
      expect(result.current.older).toBe('limit')
      act(() => result.current.loadOlder())
      expect(mocks.fetchKlines).toHaveBeenCalledTimes(MAX_CANDLES / 1000)
    })

    it('troca de par durante a carga cancela o pedido e descarta a resposta', async () => {
      const { result, rerender } = await ready(series(START, 1000))
      const older = deferred<Candle[]>()
      mocks.fetchKlines.mockReturnValueOnce(older.promise).mockResolvedValueOnce([c(60)])
      act(() => result.current.loadOlder())
      rerender({ s: 'ETHUSDT' })
      await waitFor(() => expect(result.current.status).toBe('ready'))
      await act(async () => older.resolve(series(START - 1000 * 60, 1000)))

      expect(mocks.fetchKlines.mock.calls[1]![0].signal.aborted).toBe(true)
      expect(result.current.candles).toEqual([c(60)])
      expect(result.current.older).toBe('end')
    })

    describe('reconexão', () => {
      beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
      afterEach(() => vi.useRealTimers())

      async function reconnect() {
        act(() => FakeWebSocket.last().drop())
        await act(async () => vi.advanceTimersByTime(20))
        act(() => FakeWebSocket.last().open())
      }

      it('mantém o histórico anterior quando a recarga encosta nele', async () => {
        const { result } = await ready(series(START, 1000))
        act(() => FakeWebSocket.last().open())
        mocks.fetchKlines.mockResolvedValueOnce(series(START - 1000 * 60, 1000))
        act(() => result.current.loadOlder())
        await waitFor(() => expect(result.current.candles).toHaveLength(2000))

        mocks.fetchKlines.mockResolvedValueOnce(series(START + 5 * 60, 1000))
        await reconnect()
        await waitFor(() => expect(result.current.candles).toHaveLength(2005))
        expect(result.current.candles[0]!.time).toBe(START - 1999 * 60)
        expect(result.current.older).toBe('idle')
      })

      it('recomeça só com a recarga quando há lacuna', async () => {
        const { result } = await ready(series(START, 1000))
        act(() => FakeWebSocket.last().open())
        mocks.fetchKlines.mockResolvedValueOnce(series(START - 1000 * 60, 10))
        act(() => result.current.loadOlder())
        await waitFor(() => expect(result.current.older).toBe('end'))

        mocks.fetchKlines.mockResolvedValueOnce(series(START + 5000 * 60, 1000))
        await reconnect()
        await waitFor(() => expect(result.current.candles[0]!.time).toBe(START + 4001 * 60))
        expect(result.current.candles).toHaveLength(1000)
        expect(result.current.older).toBe('idle')
      })

      it('cancela a carga do histórico anterior em andamento', async () => {
        const { result } = await ready(series(START, 1000))
        act(() => FakeWebSocket.last().open())
        const older = deferred<Candle[]>()
        mocks.fetchKlines
          .mockReturnValueOnce(older.promise)
          .mockResolvedValueOnce(series(START + 60, 1000))
        act(() => result.current.loadOlder())

        await reconnect()
        await waitFor(() => expect(result.current.candles.at(-1)!.time).toBe(START + 60))
        expect(mocks.fetchKlines.mock.calls[1]![0].signal.aborted).toBe(true)
        expect(result.current.older).toBe('idle')
        await act(async () => older.resolve(series(START - 1000 * 60, 1000)))
        expect(result.current.candles).toHaveLength(1001)
      })
    })
  })
})
