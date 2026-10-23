import { useEffect, useState } from 'react'
import type { Candle, IntervalId } from '../domain/types'
import { fetchKlines } from '../services/binance'
import { fetchHistoryPage } from '../services/history'

/** Velas semanais/mensais mudam devagar: reaproveita por 1 hora. */
const TTL_MS = 60 * 60 * 1000
const cache = new Map<string, { at: number; promise: Promise<Candle[] | null> }>()

function cached(key: string, load: () => Promise<Candle[] | null>): Promise<Candle[] | null> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise
  const promise = load().catch(() => null)
  cache.set(key, { at: Date.now(), promise })
  return promise
}

/** Limpa o cache (testes). */
export function clearHigherTimeframesCache() {
  cache.clear()
}

export interface HigherTimeframes {
  /** Todas as semanas do par (BTC desde 2011); null se não precisa ou falhou. */
  weekly: Candle[] | null
  /** Últimos 24 meses do par; null se não precisa ou falhou. */
  monthly: Candle[] | null
}

/**
 * Velas semanais e mensais para indicadores calculados em semanas (Faixa de
 * Bull, médias de 50/200 semanas) quando o gráfico está em outro tempo.
 */
export function useHigherTimeframes(
  symbol: string,
  interval: IntervalId,
  needWeekly: boolean,
  needMonthly: boolean,
): HigherTimeframes {
  const wantWeekly = needWeekly && interval !== '1w'
  const wantMonthly = needMonthly && interval !== '1M'
  const [state, setState] = useState<HigherTimeframes & { key: string }>({
    key: '',
    weekly: null,
    monthly: null,
  })
  const key = `${symbol}:${wantWeekly}:${wantMonthly}`

  useEffect(() => {
    let cancelled = false
    const weekly = wantWeekly
      ? cached(
          `${symbol}:1w`,
          async () => (await fetchHistoryPage({ symbol, interval: '1w' })).candles,
        )
      : Promise.resolve(null)
    const monthly = wantMonthly
      ? cached(`${symbol}:1M`, () => fetchKlines({ symbol, interval: '1M', limit: 24 }))
      : Promise.resolve(null)
    void Promise.all([weekly, monthly]).then(([w, m]) => {
      if (!cancelled) setState({ key, weekly: w, monthly: m })
    })
    return () => {
      cancelled = true
    }
  }, [key, symbol, wantWeekly, wantMonthly])

  return state.key === key ? state : { weekly: null, monthly: null }
}
