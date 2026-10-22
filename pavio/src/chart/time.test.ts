import { TickMarkType } from 'lightweight-charts'
import { describe, expect, it } from 'vitest'
import { formatCrosshairTime, formatTickMark, localOffsetSeconds } from './time'

// 2026-10-22 14:35:09 UTC, quinta-feira
const t = Date.UTC(2026, 9, 22, 14, 35, 9) / 1000

describe('formatTickMark', () => {
  it.each([
    [TickMarkType.Year, '2026'],
    [TickMarkType.Month, 'out'],
    [TickMarkType.DayOfMonth, '22'],
    [TickMarkType.Time, '14:35'],
    [TickMarkType.TimeWithSeconds, '14:35:09'],
  ])('tipo %i -> %s', (type, expected) => {
    expect(formatTickMark(t, type)).toBe(expected)
  })
})

describe('formatCrosshairTime', () => {
  it('mostra data e hora em intervalos intradiários', () => {
    expect(formatCrosshairTime(t, true)).toBe('qui 22 out 26  14:35')
  })
  it('mostra só a data no diário', () => {
    expect(formatCrosshairTime(t, false)).toBe('qui 22 out 26')
  })
})

it('localOffsetSeconds inverte o sinal de getTimezoneOffset', () => {
  const brt = { getTimezoneOffset: () => 180 } as Date
  expect(localOffsetSeconds(brt)).toBe(-3 * 3600)
})
