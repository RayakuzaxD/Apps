import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeWebSocket } from '../../../tests/helpers/fakeWebSocket'
import { BinanceStream, type StreamStatus } from './stream'

const tick = () => Promise.resolve()

function createStream() {
  return new BinanceStream({
    url: 'wss://example.test/stream',
    WebSocketImpl: FakeWebSocket as unknown as new (url: string) => WebSocket,
    initialBackoffMs: 1000,
    maxBackoffMs: 8000,
    random: () => 0.5, // jitter neutro
  })
}

describe('BinanceStream', () => {
  beforeEach(() => {
    FakeWebSocket.reset()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('conecta sob demanda e inscreve em lote ao abrir', async () => {
    const stream = createStream()
    expect(FakeWebSocket.instances).toHaveLength(0)

    stream.subscribe('btcusdt@kline_1m', () => {})
    stream.subscribe('ethusdt@kline_1m', () => {})
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.last().url).toBe('wss://example.test/stream')

    FakeWebSocket.last().open()
    await tick()
    expect(FakeWebSocket.last().sent).toEqual([
      { method: 'SUBSCRIBE', params: ['btcusdt@kline_1m', 'ethusdt@kline_1m'], id: 1 },
    ])
  })

  it('entrega mensagens apenas aos ouvintes do stream', async () => {
    const stream = createStream()
    const a = vi.fn()
    const b = vi.fn()
    stream.subscribe('a', a)
    stream.subscribe('b', b)
    FakeWebSocket.last().open()
    FakeWebSocket.last().emit('a', { x: 1 })
    expect(a).toHaveBeenCalledWith({ x: 1 })
    expect(b).not.toHaveBeenCalled()
  })

  it('conta referências: só cancela quando o último ouvinte sai', async () => {
    const stream = createStream()
    FakeWebSocket.reset()
    const off1 = stream.subscribe('a', () => {})
    const off2 = stream.subscribe('a', () => {})
    const ws = FakeWebSocket.last()
    ws.open()
    await tick()
    ws.sent = []

    off1()
    await tick()
    expect(ws.sent).toEqual([])

    off2()
    off2() // idempotente
    await tick()
    expect(ws.sent).toEqual([{ method: 'UNSUBSCRIBE', params: ['a'], id: 2 }])
  })

  it('agrupa trocas no mesmo tick e cancela inscrição desfeita', async () => {
    const stream = createStream()
    const off = stream.subscribe('a', () => {})
    const ws = FakeWebSocket.last()
    ws.open()
    await tick()
    ws.sent = []

    off()
    stream.subscribe('b', () => {})
    const offC = stream.subscribe('c', () => {})
    offC()
    await tick()
    expect(ws.sent).toEqual([
      { method: 'UNSUBSCRIBE', params: ['a'], id: 2 },
      { method: 'SUBSCRIBE', params: ['b'], id: 3 },
    ])
  })

  it('reconecta com backoff exponencial e reinscreve', async () => {
    const stream = createStream()
    const statuses: StreamStatus[] = []
    stream.onStatus((s) => statuses.push(s))
    stream.subscribe('a', () => {})
    FakeWebSocket.last().open()

    FakeWebSocket.last().drop()
    expect(statuses).toEqual(['connecting', 'open', 'reconnecting'])
    expect(FakeWebSocket.instances).toHaveLength(1)

    vi.advanceTimersByTime(999)
    expect(FakeWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(2)

    // Segunda falha seguida dobra a espera.
    FakeWebSocket.last().drop()
    vi.advanceTimersByTime(1999)
    expect(FakeWebSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(3)

    const ws = FakeWebSocket.last()
    ws.open()
    expect(ws.sent).toEqual([{ method: 'SUBSCRIBE', params: ['a'], id: 2 }])
    expect(statuses[statuses.length - 1]).toBe('open')
  })

  it('limita o backoff ao máximo', () => {
    const stream = createStream()
    stream.subscribe('a', () => {})
    for (let i = 0; i < 6; i++) {
      FakeWebSocket.last().drop()
      vi.advanceTimersByTime(8000)
    }
    expect(FakeWebSocket.instances).toHaveLength(7)
  })

  it('ignora mensagens inválidas', () => {
    const stream = createStream()
    const fn = vi.fn()
    stream.subscribe('a', fn)
    const ws = FakeWebSocket.last()
    ws.open()
    ws.onmessage?.(new MessageEvent('message', { data: 'não é json' }))
    ws.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ result: null, id: 1 }) }))
    expect(fn).not.toHaveBeenCalled()
  })

  it('dispose fecha sem reconectar', () => {
    const stream = createStream()
    stream.subscribe('a', () => {})
    FakeWebSocket.last().open()
    stream.dispose()
    vi.advanceTimersByTime(60_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(stream.getStatus()).toBe('idle')
  })
})
