import { useCallback, useEffect, useRef, useState } from 'react'
import { mergeCandle, mergeCandles, prependCandles } from '../domain/candles'
import type { Candle, IntervalId } from '../domain/types'
import {
  explainLoadError,
  getBinanceStream,
  isAbortError,
  klineStreamName,
  parseKlineEvent,
} from '../services/binance'
import { fetchHistoryPage } from '../services/history'

export type KlinesStatus = 'loading' | 'ready' | 'error'

/**
 * Situação do histórico anterior: `idle` pode carregar mais, `end` chegou ao
 * início do histórico disponível e `limit` atingiu o máximo de candles mantidos.
 */
export type OlderStatus = 'idle' | 'loading' | 'error' | 'end' | 'limit'

/** Máximo de candles por série, para manter leve o recálculo dos indicadores. */
export const MAX_CANDLES = 20_000

export interface KlinesResult {
  candles: Candle[]
  status: KlinesStatus
  error: unknown
  retry: () => void
  older: OlderStatus
  /** Carrega candles anteriores ao primeiro (ignorado se não estiver `idle`). */
  loadOlder: () => void
  /** Tenta de novo após falha ao carregar o histórico anterior. */
  retryOlder: () => void
}

interface State {
  key: string
  candles: Candle[]
  status: KlinesStatus
  error: unknown
  older: OlderStatus
}

const EMPTY: Candle[] = []

/**
 * Histórico via REST + atualizações via WebSocket para um par/intervalo.
 * Eventos que chegam antes do histórico ficam em buffer e são mesclados depois.
 * Após uma reconexão do WebSocket, o histórico é recarregado para cobrir lacunas.
 * Candles anteriores são buscados sob demanda (`loadOlder`) e juntados ao início.
 */
export function useKlines(symbol: string, interval: IntervalId): KlinesResult {
  const key = `${symbol}:${interval}`
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<State>({
    key,
    candles: EMPTY,
    status: 'loading',
    error: null,
    older: 'idle',
  })
  const olderRef = useRef<{ load: () => void; retry: () => void } | null>(null)

  useEffect(() => {
    const stream = getBinanceStream()
    let disposed = false
    let failed = false
    let candles: Candle[] = EMPTY
    let buffer: Candle[] | null = []
    let controller: AbortController | null = null
    let olderController: AbortController | null = null
    let older: OlderStatus = 'idle'
    let interrupted = false

    const setOlder = (next: OlderStatus) => {
      older = next
      setState((s) => (s.key === key ? { ...s, older } : s))
    }

    const load = async (initial: boolean) => {
      controller?.abort()
      // Uma recarga pode trocar o início da série: o pedido antigo perde a referência.
      if (older === 'loading') {
        olderController?.abort()
        setOlder('idle')
      }
      const current = new AbortController()
      controller = current
      buffer = []
      if (initial) setState({ key, candles: EMPTY, status: 'loading', error: null, older })
      try {
        const page = await fetchHistoryPage({ symbol, interval, signal: current.signal })
        if (disposed || current.signal.aborted) return
        const history = page.candles
        // Na recarga, mantém o histórico anterior se ele encosta no recarregado;
        // com lacuna (desconexão longa), recomeça só com o recarregado.
        const last = candles[candles.length - 1]
        const contiguous =
          last !== undefined && history[0] !== undefined && last.time >= history[0].time
        if (contiguous) {
          candles = prependCandles(candles, history)
        } else {
          candles = history
          older = page.hasMore ? 'idle' : 'end'
        }
        candles = mergeCandles(candles, buffer ?? [])
        buffer = null
        setState({ key, candles, status: 'ready', error: null, older })
      } catch (error) {
        if (disposed || isAbortError(error)) return
        buffer = null
        // Numa recarga após reconexão, mantém os dados atuais e segue ao vivo.
        if (initial) {
          failed = true
          const explained = await explainLoadError(error, symbol)
          if (disposed) return
          setState({ key, candles: EMPTY, status: 'error', error: explained, older })
        }
      }
    }

    const loadOlder = async () => {
      const first = candles[0]
      if (older !== 'idle' || failed || buffer || !first) return
      if (candles.length >= MAX_CANDLES) {
        setOlder('limit')
        return
      }
      const current = new AbortController()
      olderController = current
      setOlder('loading')
      try {
        const page = await fetchHistoryPage({
          symbol,
          interval,
          endTime: first.time * 1000 - 1,
          signal: current.signal,
        })
        if (disposed || current.signal.aborted) return
        candles = prependCandles(page.candles, candles)
        older = !page.hasMore ? 'end' : candles.length >= MAX_CANDLES ? 'limit' : 'idle'
        setState((s) => (s.key === key ? { ...s, candles, older } : s))
      } catch (error) {
        if (disposed || isAbortError(error)) return
        setOlder('error')
      }
    }

    olderRef.current = {
      load: () => void loadOlder(),
      retry: () => {
        if (older !== 'error') return
        older = 'idle'
        void loadOlder()
      },
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
      olderRef.current = null
      controller?.abort()
      olderController?.abort()
      offData()
      offStatus()
    }
  }, [key, symbol, interval, attempt])

  const loadOlder = useCallback(() => olderRef.current?.load(), [])
  const retryOlder = useCallback(() => olderRef.current?.retry(), [])

  // Enquanto o efeito da nova chave não roda, não exibe dados da série anterior.
  const current: State =
    state.key === key
      ? state
      : { key, candles: EMPTY, status: 'loading', error: null, older: 'idle' }
  return {
    candles: current.candles,
    status: current.status,
    error: current.error,
    retry: () => setAttempt((n) => n + 1),
    older: current.older,
    loadOlder,
    retryOlder,
  }
}
