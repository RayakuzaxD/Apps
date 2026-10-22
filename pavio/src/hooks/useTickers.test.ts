import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMiniTicker } from '../../tests/fixtures/tickers'
import { FakeWebSocket } from '../../tests/helpers/fakeWebSocket'
import { BinanceApiError } from '../services/binance/rest'
import { BinanceStream } from '../services/binance/stream'
import { TICKER_FLUSH_MS, applyTickerUpdate, useTickers } from './useTickers'

const mocks = vi.hoisted(() => ({
  fetchTicker24h: vi.fn(),
  stream: null as unknown as BinanceStream,
}))

vi.mock('../services/binance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/binance')>()),
  fetchTicker24h: mocks.fetchTicker24h,
  getBinanceStream: () => mocks.stream,
}))

const snap = (symbol: string, price: number, open: number) => ({ symbol, price, open })

async function flush() {
  await act(async () => {
    await Promise.resolve()
    vi.advanceTimersByTime(TICKER_FLUSH_MS)
  })
}

describe('applyTickerUpdate', () => {
  const loading = { status: 'loading' as const, price: null, change: null, direction: null, seq: 0 }

  it('snapshot preenche preço e variação', () => {
    expect(applyTickerUpdate(undefined, { kind: 'snapshot', ticker: snap('A', 110, 100) })).toEqual(
      {
        status: 'ready',
        price: 110,
        change: expect.closeTo(0.1, 10),
        direction: null,
        seq: 0,
      },
    )
  })

  it('tempo real marca a direção e incrementa a sequência', () => {
    const a = applyTickerUpdate(loading, { kind: 'live', ticker: snap('A', 100, 100) })
    const up = applyTickerUpdate(a, { kind: 'live', ticker: snap('A', 101, 100) })
    const down = applyTickerUpdate(up, { kind: 'live', ticker: snap('A', 99, 100) })
    const same = applyTickerUpdate(down, { kind: 'live', ticker: snap('A', 99, 100) })
    expect([up.direction, down.direction, same.direction]).toEqual(['up', 'down', 'down'])
    expect([a.seq, up.seq, down.seq, same.seq]).toEqual([0, 1, 2, 2])
  })

  it('snapshot atrasado não sobrescreve dado ao vivo', () => {
    const live = applyTickerUpdate(loading, { kind: 'live', ticker: snap('A', 105, 100) })
    expect(applyTickerUpdate(live, { kind: 'snapshot', ticker: snap('A', 90, 100) })).toBe(live)
  })

  it('erro só aparece se ainda não há dado', () => {
    expect(applyTickerUpdate(loading, { kind: 'error', error: 'x' }).status).toBe('error')
    const live = applyTickerUpdate(loading, { kind: 'live', ticker: snap('A', 1, 1) })
    expect(applyTickerUpdate(live, { kind: 'error', error: 'x' })).toBe(live)
  })
})

describe('useTickers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.reset()
    mocks.fetchTicker24h.mockReset()
    mocks.stream = new BinanceStream({
      url: 'wss://example.test/stream',
      WebSocketImpl: FakeWebSocket as unknown as new (url: string) => WebSocket,
    })
  })
  afterEach(() => {
    mocks.stream.dispose()
    vi.useRealTimers()
  })

  it('carrega snapshot, assina miniTicker e aplica tempo real em lote', async () => {
    mocks.fetchTicker24h.mockImplementation(async (s: string) =>
      s === 'BTCUSDT' ? snap(s, 101, 100) : snap(s, 2900, 3000),
    )
    const { result } = renderHook(() => useTickers(['BTCUSDT', 'ETHUSDT']))
    expect(result.current.BTCUSDT!.status).toBe('loading')

    await flush()
    expect(result.current.BTCUSDT).toMatchObject({ status: 'ready', price: 101 })
    expect(result.current.ETHUSDT!.change).toBeCloseTo(-100 / 3000, 10)

    const ws = FakeWebSocket.last()
    act(() => ws.open())
    expect(ws.sent[0]).toMatchObject({
      method: 'SUBSCRIBE',
      params: ['btcusdt@miniTicker', 'ethusdt@miniTicker'],
    })

    act(() => {
      ws.emit('btcusdt@miniTicker', makeMiniTicker('BTCUSDT', 102, 100))
      ws.emit('btcusdt@miniTicker', makeMiniTicker('BTCUSDT', 103, 100))
    })
    // Agrupado: nada muda antes do flush.
    expect(result.current.BTCUSDT!.price).toBe(101)
    await flush()
    expect(result.current.BTCUSDT).toMatchObject({ price: 103, direction: 'up', seq: 2 })
  })

  it('erro em um par não afeta os outros', async () => {
    mocks.fetchTicker24h.mockImplementation(async (s: string) => {
      if (s === 'NOPEUSDT') throw new BinanceApiError('Invalid symbol.', 400, -1121)
      return snap(s, 1, 1)
    })
    const { result } = renderHook(() => useTickers(['BTCUSDT', 'NOPEUSDT']))
    await flush()
    expect(result.current.BTCUSDT!.status).toBe('ready')
    expect(result.current.NOPEUSDT!.status).toBe('error')
  })

  it('remover um par cancela a assinatura e apaga o estado dele', async () => {
    mocks.fetchTicker24h.mockImplementation(async (s: string) => snap(s, 1, 1))
    const { result, rerender } = renderHook(({ list }) => useTickers(list), {
      initialProps: { list: ['BTCUSDT', 'ETHUSDT'] },
    })
    await flush()
    const ws = FakeWebSocket.last()
    act(() => ws.open())
    ws.sent = []

    rerender({ list: ['BTCUSDT'] })
    await flush()
    expect(Object.keys(result.current)).toEqual(['BTCUSDT'])
    expect(ws.sent).toEqual([{ method: 'UNSUBSCRIBE', params: ['ethusdt@miniTicker'], id: 2 }])

    // Readicionar começa do zero (carregando), sem mostrar o preço antigo.
    mocks.fetchTicker24h.mockImplementation(() => new Promise(() => {}))
    rerender({ list: ['BTCUSDT', 'ETHUSDT'] })
    expect(result.current.ETHUSDT!.status).toBe('loading')
  })

  it('desmontar encerra assinaturas e pedidos', async () => {
    let signal: AbortSignal | undefined
    mocks.fetchTicker24h.mockImplementation((_s: string, sig: AbortSignal) => {
      signal = sig
      return new Promise(() => {})
    })
    const { unmount } = renderHook(() => useTickers(['BTCUSDT']))
    const ws = FakeWebSocket.last()
    act(() => ws.open())
    ws.sent = []
    unmount()
    await act(async () => Promise.resolve())
    expect(signal?.aborted).toBe(true)
    expect(ws.sent).toEqual([{ method: 'UNSUBSCRIBE', params: ['btcusdt@miniTicker'], id: 2 }])
  })
})
