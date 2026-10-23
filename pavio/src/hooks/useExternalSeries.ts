import { useEffect, useMemo, useState } from 'react'
import { isExternalSeries, type ExternalSeries } from '../data/series'

const cache = new Map<string, Promise<ExternalSeries | null>>()

/**
 * Série publicada pelo robô de dados (`data/<id>.json`, ao lado do site).
 * Arquivo ausente ou inválido = null ("sem dado"); uma tentativa por sessão.
 */
export function loadExternalSeries(id: string, fetchImpl: typeof fetch = fetch) {
  let promise = cache.get(id)
  if (!promise) {
    const url = new URL(`data/${id}.json`, document.baseURI).toString()
    promise = fetchImpl(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: unknown) => (isExternalSeries(body, id) ? body : null))
      .catch(() => null)
    cache.set(id, promise)
  }
  return promise
}

/** Limpa o cache (testes). */
export function clearExternalSeriesCache() {
  cache.clear()
}

/** Séries externas pedidas, por id; ausentes enquanto carregam ou quando não há dado. */
export function useExternalSeries(ids: readonly string[]): Partial<Record<string, ExternalSeries>> {
  const key = [...new Set(ids)].sort().join(',')
  const [loaded, setLoaded] = useState<Record<string, ExternalSeries | null>>({})

  useEffect(() => {
    if (!key) return
    let cancelled = false
    for (const id of key.split(',')) {
      void loadExternalSeries(id).then((series) => {
        if (cancelled) return
        setLoaded((prev) => (id in prev && prev[id] === series ? prev : { ...prev, [id]: series }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [key])

  return useMemo(() => {
    const result: Partial<Record<string, ExternalSeries>> = {}
    if (!key) return result
    for (const id of key.split(',')) {
      const series = loaded[id]
      if (series) result[id] = series
    }
    return result
  }, [key, loaded])
}
