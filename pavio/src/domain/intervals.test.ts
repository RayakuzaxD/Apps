import { describe, expect, it } from 'vitest'
import { INTERVALS, getInterval, isIntervalId, isIntraday, timeDetail } from './intervals'

describe('intervalos', () => {
  it('inclui semanal (1S) e mensal (1M) com os ids da Binance', () => {
    expect(INTERVALS.map((i) => i.label)).toEqual(['1m', '5m', '15m', '1h', '4h', '1D', '1S', '1M'])
    expect(getInterval('1w').seconds).toBe(7 * 86_400)
    expect(getInterval('1M').seconds).toBe(2_629_800)
    expect(isIntervalId('1M')).toBe(true)
    expect(isIntervalId('1mo')).toBe(false)
  })

  it.each([
    ['1h', true, 'intraday'],
    ['1d', false, 'day'],
    ['1w', false, 'day'],
    ['1M', false, 'month'],
  ] as const)('%s: intradiário %s, detalhe %s', (id, intraday, detail) => {
    expect(isIntraday(id)).toBe(intraday)
    expect(timeDetail(id)).toBe(detail)
  })
})
