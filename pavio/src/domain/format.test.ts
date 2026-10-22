import { describe, expect, it } from 'vitest'
import { formatPercent, formatPrice, formatVolume } from './format'

const normalize = (s: string) => s.replace(/\s/g, ' ')

describe('formatação pt-BR', () => {
  it('preço com casas fixas', () => {
    expect(formatPrice(83456.7, 2)).toBe('83.456,70')
    expect(formatPrice(0.123456, 5)).toBe('0,12346')
  })

  it('volume compacto', () => {
    expect(normalize(formatVolume(1234))).toBe('1,23 mil')
    expect(normalize(formatVolume(5_600_000))).toBe('5,6 mi')
  })

  it('percentual com sinal', () => {
    expect(formatPercent(0.0123)).toBe('+1,23%')
    expect(formatPercent(-0.05)).toBe('-5,00%')
    expect(formatPercent(0)).toBe('0,00%')
  })
})
