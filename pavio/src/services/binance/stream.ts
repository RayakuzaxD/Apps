export type StreamStatus = 'idle' | 'connecting' | 'open' | 'reconnecting'

type DataListener = (data: unknown) => void
type StatusListener = (status: StreamStatus) => void

type WebSocketCtor = new (url: string) => WebSocket

const WS_OPEN = 1

export interface BinanceStreamOptions {
  /** URL do endpoint combinado, ex.: wss://data-stream.binance.vision/stream */
  url: string
  WebSocketImpl?: WebSocketCtor
  initialBackoffMs?: number
  maxBackoffMs?: number
  random?: () => number
}

/**
 * Uma única conexão WebSocket combinada da Binance, compartilhada pelo app.
 * Inscrições são contadas por stream, agrupadas em lote (SUBSCRIBE/UNSUBSCRIBE)
 * e refeitas automaticamente após reconexão com backoff exponencial.
 */
export class BinanceStream {
  private readonly url: string
  private readonly WebSocketImpl: WebSocketCtor
  private readonly initialBackoffMs: number
  private readonly maxBackoffMs: number
  private readonly random: () => number

  private ws: WebSocket | null = null
  private status: StreamStatus = 'idle'
  private readonly listeners = new Map<string, Set<DataListener>>()
  private readonly statusListeners = new Set<StatusListener>()
  private readonly pendingSub = new Set<string>()
  private readonly pendingUnsub = new Set<string>()
  private flushScheduled = false
  private nextId = 1
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  constructor(options: BinanceStreamOptions) {
    this.url = options.url
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket
    this.initialBackoffMs = options.initialBackoffMs ?? 1000
    this.maxBackoffMs = options.maxBackoffMs ?? 30_000
    this.random = options.random ?? Math.random
  }

  getStatus(): StreamStatus {
    return this.status
  }

  subscribe(stream: string, listener: DataListener): () => void {
    let set = this.listeners.get(stream)
    if (!set) {
      set = new Set()
      this.listeners.set(stream, set)
      if (!this.pendingUnsub.delete(stream)) this.pendingSub.add(stream)
      this.scheduleFlush()
    }
    set.add(listener)
    this.ensureConnected()

    let active = true
    return () => {
      if (!active) return
      active = false
      const current = this.listeners.get(stream)
      if (!current) return
      current.delete(listener)
      if (current.size === 0) {
        this.listeners.delete(stream)
        if (!this.pendingSub.delete(stream)) this.pendingUnsub.add(stream)
        this.scheduleFlush()
      }
    }
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  dispose(): void {
    this.disposed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.listeners.clear()
    this.statusListeners.clear()
    const ws = this.ws
    this.ws = null
    ws?.close()
    this.status = 'idle'
  }

  private setStatus(status: StreamStatus) {
    if (this.status === status) return
    this.status = status
    for (const l of this.statusListeners) l(status)
  }

  private ensureConnected() {
    if (this.disposed || this.ws || this.reconnectTimer) return
    this.connect()
  }

  private connect() {
    this.reconnectTimer = null
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')
    const ws = new this.WebSocketImpl(this.url)
    this.ws = ws

    ws.onopen = () => {
      if (this.ws !== ws) return
      this.attempt = 0
      // Conexão nova: tudo que está ativo precisa ser (re)inscrito.
      this.pendingSub.clear()
      this.pendingUnsub.clear()
      const streams = [...this.listeners.keys()]
      if (streams.length > 0) this.send('SUBSCRIBE', streams)
      this.setStatus('open')
    }

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws) return
      let msg: unknown
      try {
        msg = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (typeof msg !== 'object' || msg === null) return
      const { stream, data } = msg as { stream?: unknown; data?: unknown }
      if (typeof stream !== 'string') return
      const set = this.listeners.get(stream)
      if (!set) return
      for (const l of [...set]) l(data)
    }

    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      if (this.disposed) return
      if (this.listeners.size === 0) {
        this.attempt = 0
        this.setStatus('idle')
        return
      }
      this.scheduleReconnect()
    }

    // Erros sempre resultam em onclose; a reconexão é tratada lá.
    ws.onerror = () => {}
  }

  private scheduleReconnect() {
    const base = Math.min(this.maxBackoffMs, this.initialBackoffMs * 2 ** this.attempt)
    const delay = Math.round(base * (0.8 + 0.4 * this.random()))
    this.attempt += 1
    this.setStatus('reconnecting')
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private scheduleFlush() {
    if (this.flushScheduled) return
    this.flushScheduled = true
    queueMicrotask(() => {
      this.flushScheduled = false
      this.flush()
    })
  }

  private flush() {
    if (!this.ws || this.ws.readyState !== WS_OPEN) return
    if (this.pendingUnsub.size > 0) this.send('UNSUBSCRIBE', [...this.pendingUnsub])
    if (this.pendingSub.size > 0) this.send('SUBSCRIBE', [...this.pendingSub])
    this.pendingUnsub.clear()
    this.pendingSub.clear()
  }

  private send(method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) {
    this.ws?.send(JSON.stringify({ method, params, id: this.nextId++ }))
  }
}
