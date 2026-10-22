import { useSyncExternalStore } from 'react'
import { getBinanceStream, type StreamStatus } from '../services/binance'

export function useStreamStatus(): StreamStatus {
  const stream = getBinanceStream()
  return useSyncExternalStore(
    (onChange) => stream.onStatus(onChange),
    () => stream.getStatus(),
  )
}
