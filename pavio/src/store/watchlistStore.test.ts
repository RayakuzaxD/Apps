import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_WATCHLIST,
  MAX_WATCHLIST,
  sanitizeWatchlist,
  useWatchlistStore,
} from './watchlistStore'

const store = () => useWatchlistStore.getState()

describe('useWatchlistStore', () => {
  beforeEach(() => useWatchlistStore.setState({ symbols: ['BTCUSDT'] }))

  it('começa com os pares padrão', () => {
    expect(DEFAULT_WATCHLIST).toContain('BTCUSDT')
    expect(DEFAULT_WATCHLIST).toContain('ETHUSDT')
  })

  it('adiciona sem duplicar e rejeita formato inválido', () => {
    expect(store().add('ETHUSDT')).toBe(true)
    expect(store().add('ETHUSDT')).toBe(false)
    expect(store().add('eth')).toBe(false)
    expect(store().symbols).toEqual(['BTCUSDT', 'ETHUSDT'])
  })

  it('respeita o limite', () => {
    useWatchlistStore.setState({
      symbols: Array.from({ length: MAX_WATCHLIST }, (_, i) => `COIN${i}USDT`),
    })
    expect(store().add('NEWUSDT')).toBe(false)
  })

  it('remove e persiste', () => {
    store().add('SOLUSDT')
    store().remove('BTCUSDT')
    expect(store()).toMatchObject({ symbols: ['SOLUSDT'] })
    const saved = JSON.parse(localStorage.getItem('pavio:watchlist') ?? '{}')
    expect(saved.state).toEqual({ symbols: ['SOLUSDT'] })
  })
})

describe('sanitizeWatchlist', () => {
  it('remove inválidos e duplicados', () => {
    expect(sanitizeWatchlist(['BTCUSDT', 'x', 42, 'BTCUSDT', 'ETHUSDT'])).toEqual([
      'BTCUSDT',
      'ETHUSDT',
    ])
  })

  it('lista vazia é respeitada; formato inválido volta ao padrão', () => {
    expect(sanitizeWatchlist([])).toEqual([])
    expect(sanitizeWatchlist('lixo')).toEqual(DEFAULT_WATCHLIST)
  })
})
