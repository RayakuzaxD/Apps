/** WebSocket falso e controlável para testes unitários. */
export class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  static reset() {
    FakeWebSocket.instances = []
  }

  static last(): FakeWebSocket {
    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
    if (!ws) throw new Error('Nenhum WebSocket criado')
    return ws
  }

  readonly url: string
  readyState = 0
  sent: { method: string; params: string[]; id: number }[] = []
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close() {
    if (this.readyState === 3) return
    this.readyState = 3
    this.onclose?.(new Event('close') as CloseEvent)
  }

  // Controles do teste
  open() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }

  emit(stream: string, data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ stream, data }) }))
  }

  drop() {
    this.readyState = 3
    this.onclose?.(new Event('close') as CloseEvent)
  }
}
