import { useEffect, useMemo, useRef, useState } from 'react'
import {
  changeRatio,
  fetchTicker24h,
  getBinanceStream,
  isAbortError,
  miniTickerStreamName,
  parseMiniTicker,
  type TickerSnapshot,
} from '../services/binance'

export type TickerStatus = 'loading' | 'ready' | 'error'

export interface TickerEntry {
  status: TickerStatus
  price: number | null
  change: number | null
  /** Direção do último movimento de preço (para o destaque visual). */
  direction: 'up' | 'down' | null
  /** Incrementa a cada mudança de preço (reinicia a animação de destaque). */
  seq: number
  error?: unknown
}

type Update =
  | { kind: 'snapshot'; ticker: TickerSnapshot }
  | { kind: 'live'; ticker: TickerSnapshot }
  | { kind: 'error'; error: unknown }

/** Intervalo de agrupamento das atualizações (evita re-render a cada mensagem). */
export const TICKER_FLUSH_MS = 200

const LOADING: TickerEntry = {
  status: 'loading',
  price: null,
  change: null,
  direction: null,
  seq: 0,
}

export function applyTickerUpdate(prev: TickerEntry | undefined, update: Update): TickerEntry {
  const current = prev ?? LOADING
  if (update.kind === 'error') {
    // Se o tempo real já trouxe preço, o erro do snapshot não importa.
    return current.status === 'ready'
      ? current
      : { ...current, status: 'error', error: update.error }
  }
  // O snapshot REST não sobrescreve dados mais novos vindos do WebSocket.
  if (update.kind === 'snapshot' && current.status === 'ready') return current

  const { price } = update.ticker
  const moved = current.price !== null && price !== current.price
  return {
    status: 'ready',
    price,
    change: changeRatio(update.ticker),
    direction: moved ? (price > current.price! ? 'up' : 'down') : current.direction,
    seq: moved ? current.seq + 1 : current.seq,
  }
}

/**
 * Preço e variação de 24h em tempo real para uma lista de pares:
 * snapshot via REST (um pedido por par, para que um par inválido não derrube
 * os outros) e atualizações pelo stream miniTicker no WebSocket compartilhado.
 */
export function useTickers(symbols: readonly string[]): Record<string, TickerEntry> {
  const [entries, setEntries] = useState<Record<string, TickerEntry>>({})
  const subscriptions = useRef(new Map<string, () => void>())
  // `update: null` = par removido (apaga o estado dele no próximo flush).
  const pending = useRef<{ symbol: string; update: Update | null }[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const key = symbols.join(',')

  useEffect(() => {
    const subs = subscriptions.current
    const queue = (symbol: string, update: Update | null) => {
      pending.current.push({ symbol, update })
      if (timer.current !== null) return
      timer.current = setTimeout(() => {
        timer.current = null
        const batch = pending.current
        pending.current = []
        setEntries((prev) => {
          const next = { ...prev }
          for (const { symbol: s, update: u } of batch) {
            if (!subs.has(s)) delete next[s]
            else if (u) next[s] = applyTickerUpdate(next[s], u)
          }
          return next
        })
      }, TICKER_FLUSH_MS)
    }

    const wanted = new Set(key ? key.split(',') : [])
    const stream = getBinanceStream()

    for (const [symbol, stop] of subs) {
      if (!wanted.has(symbol)) {
        stop()
        subs.delete(symbol)
        queue(symbol, null)
      }
    }

    for (const symbol of wanted) {
      if (subs.has(symbol)) continue
      const controller = new AbortController()
      fetchTicker24h(symbol, controller.signal).then(
        (ticker) => queue(symbol, { kind: 'snapshot', ticker }),
        (error: unknown) => {
          if (!isAbortError(error)) queue(symbol, { kind: 'error', error })
        },
      )
      const unsubscribe = stream.subscribe(miniTickerStreamName(symbol), (data) => {
        const ticker = parseMiniTicker(data)
        if (ticker) queue(symbol, { kind: 'live', ticker })
      })
      subs.set(symbol, () => {
        controller.abort()
        unsubscribe()
      })
    }
  }, [key])

  // Ao desmontar: encerra tudo.
  useEffect(() => {
    const subs = subscriptions.current
    return () => {
      for (const stop of subs.values()) stop()
      subs.clear()
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
      pending.current = []
    }
  }, [])

  return useMemo(() => {
    const result: Record<string, TickerEntry> = {}
    for (const s of key ? key.split(',') : []) result[s] = entries[s] ?? LOADING
    return result
  }, [entries, key])
}
