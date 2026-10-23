import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIXTURE_START, fullContext } from '../../tests/fixtures/indicatorContext'
import { defaultParams, type IndicatorConfig } from '../domain/indicators/registry'
import type { Candle } from '../domain/types'
import {
  clearExternalSeriesCache,
  loadExternalSeries,
  useExternalSeries,
} from './useExternalSeries'
import { clearHigherTimeframesCache, useHigherTimeframes } from './useHigherTimeframes'
import { collectRequirements, useIndicatorResults } from './useIndicatorResults'

const mocks = vi.hoisted(() => ({ fetchKlines: vi.fn(), fetchHistoryPage: vi.fn() }))
vi.mock('../services/binance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/binance')>()),
  fetchKlines: mocks.fetchKlines,
}))
vi.mock('../services/history', () => ({ fetchHistoryPage: mocks.fetchHistoryPage }))

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const nfci = {
  id: 'NFCI',
  title: 'NFCI',
  source: 'FRED',
  unit: 'índice',
  maxGapDays: 10,
  updatedAt: '2026-10-22T09:00:00Z',
  points: [[FIXTURE_START, -0.4]],
}

describe('séries externas', () => {
  beforeEach(() => clearExternalSeriesCache())
  afterEach(() => vi.unstubAllGlobals())

  it('busca data/<id>.json ao lado da página e valida o arquivo', async () => {
    const fetchImpl = vi.fn(async () => json(nfci))
    expect(await loadExternalSeries('NFCI', fetchImpl)).toEqual(nfci)
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toMatch(/\/data\/NFCI\.json$/)
    // Uma busca por sessão.
    await loadExternalSeries('NFCI', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('arquivo ausente, inválido ou com outro id: sem dado (null)', async () => {
    expect(
      await loadExternalSeries(
        'A',
        vi.fn(async () => json({}, 404)),
      ),
    ).toBeNull()
    expect(
      await loadExternalSeries(
        'B',
        vi.fn(async () => json({ nope: 1 })),
      ),
    ).toBeNull()
    expect(
      await loadExternalSeries(
        'C',
        vi.fn(async () => json(nfci)),
      ),
    ).toBeNull()
    expect(
      await loadExternalSeries(
        'D',
        vi.fn(async () => Promise.reject(new Error('rede'))),
      ),
    ).toBeNull()
  })

  it('hook devolve só as séries carregadas, com identidade estável', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (String(url).includes('NFCI') ? json(nfci) : json({}, 404))),
    )
    const { result, rerender } = renderHook(({ ids }) => useExternalSeries(ids), {
      initialProps: { ids: ['NFCI', 'WALCL'] },
    })
    await waitFor(() => expect(result.current.NFCI).toEqual(nfci))
    expect(result.current.WALCL).toBeUndefined()
    const first = result.current
    rerender({ ids: ['WALCL', 'NFCI'] })
    expect(result.current).toBe(first)
  })
})

describe('velas semanais e mensais', () => {
  const week: Candle = { time: FIXTURE_START, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 }
  beforeEach(() => {
    clearHigherTimeframesCache()
    mocks.fetchHistoryPage.mockReset().mockResolvedValue({ candles: [week], hasMore: false })
    mocks.fetchKlines.mockReset().mockResolvedValue([week])
  })

  it('baixa semanal (com histórico longo) e mensal quando preciso', async () => {
    const { result } = renderHook(() => useHigherTimeframes('BTCUSDT', '1d', true, true))
    await waitFor(() => expect(result.current.weekly).toEqual([week]))
    expect(result.current.monthly).toEqual([week])
    expect(mocks.fetchHistoryPage).toHaveBeenCalledWith({ symbol: 'BTCUSDT', interval: '1w' })
    expect(mocks.fetchKlines).toHaveBeenCalledWith({ symbol: 'BTCUSDT', interval: '1M', limit: 24 })
  })

  it('não baixa o que o gráfico já mostra nem o que ninguém pede', async () => {
    const { result } = renderHook(() => useHigherTimeframes('BTCUSDT', '1w', true, false))
    await waitFor(() => expect(result.current).toEqual({ weekly: null, monthly: null }))
    expect(mocks.fetchHistoryPage).not.toHaveBeenCalled()
    expect(mocks.fetchKlines).not.toHaveBeenCalled()
  })

  it('reaproveita por par e devolve null em falha', async () => {
    mocks.fetchHistoryPage.mockRejectedValueOnce(new Error('rede'))
    const first = renderHook(() => useHigherTimeframes('ETHUSDT', '1d', true, false))
    await waitFor(() => expect(mocks.fetchHistoryPage).toHaveBeenCalledTimes(1))
    expect(first.result.current.weekly).toBeNull()
    const second = renderHook(() => useHigherTimeframes('ETHUSDT', '4h', true, false))
    await waitFor(() => expect(second.result.current.weekly).toBeNull())
    expect(mocks.fetchHistoryPage).toHaveBeenCalledTimes(1)
  })
})

describe('resultados dos indicadores', () => {
  const cfg = (id: string, type: IndicatorConfig['type']): IndicatorConfig => ({
    id,
    type,
    params: defaultParams(type),
    visible: true,
  })

  it('junta o que os indicadores precisam', () => {
    expect(collectRequirements([cfg('a', 'rsi')])).toEqual({
      weekly: false,
      monthly: false,
      external: [],
    })
    const req = collectRequirements([cfg('a', 'bmsb'), cfg('b', 'nfci'), cfg('c', 'mvrv')])
    expect(req).toEqual({ weekly: true, monthly: true, external: ['BTC_MVRV', 'NFCI'] })
  })

  it('séries externas: reaproveita o resultado enquanto as velas não mudam de horário', () => {
    const { candles, data } = fullContext(60)
    const configs = [cfg('n', 'nfci'), cfg('r', 'rsi')]
    const { result, rerender } = renderHook(({ cs }) => useIndicatorResults(configs, cs, data), {
      initialProps: { cs: candles },
    })
    const [nfciBefore, rsiBefore] = result.current
    // Tick: mesmo horário da última vela, preço novo.
    const ticked = [
      ...candles.slice(0, -1),
      { ...candles.at(-1)!, close: candles.at(-1)!.close + 1 },
    ]
    rerender({ cs: ticked })
    expect(result.current[0]).toBe(nfciBefore)
    expect(result.current[1]).not.toBe(rsiBefore)
    // Vela nova: recalcula.
    rerender({ cs: [...ticked, { ...ticked.at(-1)!, time: ticked.at(-1)!.time + 86_400 }] })
    expect(result.current[0]).not.toBe(nfciBefore)
  })
})
