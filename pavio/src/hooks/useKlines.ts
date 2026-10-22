import { useEffect, useState } from 'react'
import { mergeCandle, mergeCandles } from '../domain/candles'
import type { Candle, IntervalId } from '../domain/types'
import {
  explainLoadError,
  fetchKlines,
  getBinanceStream,
  isAbortError,
  klineStreamName,
  parseKlineEvent,
} from '../services/binance'

export type KlinesStatus = 'loading' | 'ready' | 'error'

export interface KlinesResult {
  candles: Candle[]
  status: KlinesStatus
  error: unknown
  retry: () => void
}

interface State {
  key: string
  candles: Candle[]
  status: KlinesStatus
  error: unknown
}

const EMPTY: Candle[] = []

/**
 * Histórico via REST + atualizações via WebSocket para um par/intervalo.
 * Eventos que chegam antes do histórico ficam em buffer e são mesclados depois.
 * Após uma reconexão do WebSocket, o histórico é recarregado para cobrir lacunas.
 */
export function useKlines(symbol: string, interval: IntervalId): KlinesResult {
  const key = `${symbol}:${interval}`
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<State>({ key, candles: EMPTY, status: 'loading', error: null })

  useEffect(() => {
    const stream = getBinanceStream()
    let disposed = false
    let failed = false
    let candles: Candle[] = EMPTY
    let buffer: Candle[] | null = []
    let controller: AbortController | null = null
    let interrupted = false

    const load = async (initial: boolean) => {
      controller?.abort()
      const current = new AbortController()
      controller = current
      buffer = []
      if (initial) setState({ key, candles: EMPTY, status: 'loading', error: null })
      try {
        const history = await fetchKlines({ symbol, interval, signal: current.signal })
        if (disposed || current.signal.aborted) return
        candles = mergeCandles(history, buffer ?? [])
        buffer = null
        setState({ key, candles, status: 'ready', error: null })
      } catch (error) {
        if (disposed || isAbortError(error)) return
        buffer = null
        // Numa recarga após reconexão, mantém os dados atuais e segue ao vivo.
        if (initial) {
          failed = true
          const explained = await explainLoadError(error, symbol)
          if (disposed) return
          setState({ key, candles: EMPTY, status: 'error', error: explained })
        }
      }
    }

    const offData = stream.subscribe(klineStreamName(symbol, interval), (data) => {
      const event = parseKlineEvent(data)
      if (!event || failed) return
      if (buffer) {
        buffer.push(event.candle)
        return
      }
      candles = mergeCandle(candles, event.candle)
      setState((s) => (s.key === key ? { ...s, candles } : s))
    })

    const offStatus = stream.onStatus((status) => {
      if (status === 'reconnecting') interrupted = true
      else if (status === 'open' && interrupted && !failed) {
        interrupted = false
        void load(false)
      }
    })

    void load(true)

    return () => {
      disposed = true
      controller?.abort()
      offData()
      offStatus()
    }
  }, [key, symbol, interval, attempt])

  // Enquanto o efeito da nova chave não roda, não exibe dados da série anterior.
  const current =
    state.key === key ? state : { key, candles: EMPTY, status: 'loading' as const, error: null }
  return {
    candles: current.candles,
    status: current.status,
    error: current.error,
    retry: () => setAttempt((n) => n + 1),
  }
}
