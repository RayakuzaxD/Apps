import { describe, expect, it } from 'vitest'
import type { Candle } from '../domain/types'
import {
  CANDLE_SCALE_MARGINS,
  VOLUME_SCALE_MARGINS,
  volumeColor,
  volumeColors,
  withAlpha,
} from './volume'

const candle = (open: number, close: number): Candle => ({
  time: 0,
  open,
  high: Math.max(open, close),
  low: Math.min(open, close),
  close,
  volume: 1,
})

describe('withAlpha', () => {
  it('adiciona canal alfa a cores hex', () => {
    expect(withAlpha('#1FB37A', 0.5)).toBe('#1fb37a80')
    expect(withAlpha('#abc', 1)).toBe('#aabbccff')
    expect(withAlpha('#000000', 0)).toBe('#00000000')
  })

  it('limita alfa entre 0 e 1', () => {
    expect(withAlpha('#ffffff', 2)).toBe('#ffffffff')
    expect(withAlpha('#ffffff', -1)).toBe('#ffffff00')
  })

  it('devolve formatos não suportados sem alteração', () => {
    expect(withAlpha('rgb(1, 2, 3)', 0.5)).toBe('rgb(1, 2, 3)')
  })
})

describe('volumeColor', () => {
  const colors = volumeColors({ up: '#1fb37a', down: '#e5484d' })

  it('usa a cor de alta quando fecha acima ou igual à abertura', () => {
    expect(volumeColor(candle(10, 12), colors)).toBe(colors.up)
    expect(volumeColor(candle(10, 10), colors)).toBe(colors.up)
  })

  it('usa a cor de baixa quando fecha abaixo da abertura', () => {
    expect(volumeColor(candle(12, 10), colors)).toBe(colors.down)
  })

  it('cores do volume são translúcidas', () => {
    expect(colors.up).toMatch(/^#1fb37a[0-9a-f]{2}$/)
    expect(colors.up).not.toBe('#1fb37aff')
  })
})

it('volume e candles não se sobrepõem', () => {
  // A faixa do volume começa abaixo de onde os candles terminam.
  expect(1 - CANDLE_SCALE_MARGINS.bottom).toBeLessThanOrEqual(VOLUME_SCALE_MARGINS.top)
  expect(VOLUME_SCALE_MARGINS.bottom).toBe(0)
})
