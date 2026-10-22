import { binanceConfig } from './config'
import { BinanceStream } from './stream'

export { BinanceApiError, fetchKlines } from './rest'
export { klineStreamName, parseKlineEvent } from './mappers'
export type { StreamStatus } from './stream'

let stream: BinanceStream | null = null

/** Conexão WebSocket compartilhada, criada sob demanda. */
export function getBinanceStream(): BinanceStream {
  stream ??= new BinanceStream({ url: `${binanceConfig.wsUrl}/stream` })
  return stream
}
export { describeLoadError, isAbortError } from './errors'
