import { describe, expect, it } from 'vitest'
import { mergeCandle } from '../domain/candles'
import type { Candle } from '../domain/types'
import { planCandleUpdate } from './updatePlan'

const c = (time: number, close = 1): Candle => ({
  time,
  open: 1,
  high: 2,
  low: 0,
  close,
  volume: 1,
})
const base = [c(1), c(2), c(3)]

describe('planCandleUpdate', () => {
  it('reset quando a série muda', () => {
    expect(planCandleUpdate(null, [], 'BTCUSDT:1h', base)).toEqual({ kind: 'reset' })
    expect(planCandleUpdate('BTCUSDT:1h', base, 'ETHUSDT:1h', base)).toEqual({ kind: 'reset' })
  })

  it('none quando nada mudou', () => {
    expect(planCandleUpdate('k', base, 'k', base)).toEqual({ kind: 'none' })
  })

  it('update ao alterar o último candle', () => {
    const next = mergeCandle(base, c(3, 9))
    expect(planCandleUpdate('k', base, 'k', next)).toEqual({ kind: 'update', candles: [c(3, 9)] })
  })

  it('update ao anexar um candle', () => {
    const next = mergeCandle(base, c(4))
    expect(planCandleUpdate('k', base, 'k', next)).toEqual({ kind: 'update', candles: [c(4)] })
  })

  it('update com fechamento + candle novo no mesmo render', () => {
    const next = mergeCandle(mergeCandle(base, c(3, 5)), c(4))
    expect(planCandleUpdate('k', base, 'k', next)).toEqual({
      kind: 'update',
      candles: [c(3, 5), c(4)],
    })
  })

  it('replace quando o histórico foi recarregado', () => {
    const reloaded = [c(1), c(2), c(3), c(4)]
    expect(planCandleUpdate('k', base, 'k', reloaded)).toEqual({ kind: 'replace' })
  })

  it('replace quando chegam muitos candles de uma vez', () => {
    let next = base
    for (const t of [4, 5, 6]) next = mergeCandle(next, c(t))
    expect(planCandleUpdate('k', base, 'k', next)).toEqual({ kind: 'replace' })
  })

  it('replace partindo de série vazia', () => {
    expect(planCandleUpdate('k', [], 'k', base)).toEqual({ kind: 'replace' })
  })
})
