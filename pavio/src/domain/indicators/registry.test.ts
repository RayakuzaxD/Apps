import { describe, expect, it } from 'vitest'
import { fullContext } from '../../../tests/fixtures/indicatorContext'
import type { Candle } from '../types'
import {
  INDICATORS,
  INDICATOR_TYPES,
  computeIndicator,
  defaultParams,
  indicatorLabel,
  sanitizeParams,
  validateParams,
} from './registry'

const candles: Candle[] = Array.from({ length: 80 }, (_, i) => {
  const close = 100 + Math.sin(i / 5) * 10
  return { time: i * 60, open: close - 1, high: close + 2, low: close - 2, close, volume: 10 }
})

describe('registro de indicadores', () => {
  it('tem os indicadores do MVP, de ciclo e de macro, com parâmetros padrão válidos', () => {
    expect(INDICATOR_TYPES).toEqual([
      'ema',
      'sma',
      'bb',
      'rsi',
      'macd',
      'bmsb',
      'sma50w',
      'sma200w',
      'mvrv',
      'realized',
      'gli',
      'nfci',
    ])
    for (const type of INDICATOR_TYPES) {
      expect(validateParams(type, defaultParams(type)), type).toEqual({})
    }
  })

  it('cada indicador calcula todas as saídas declaradas, alinhadas aos candles', () => {
    const full = fullContext()
    for (const type of INDICATOR_TYPES) {
      const { outputs } = computeIndicator(
        { id: 'x', type, params: defaultParams(type), visible: true },
        full.candles,
        full.data,
      )
      for (const output of INDICATORS[type].outputs) {
        expect(outputs[output.key], `${type}.${output.key}`).toHaveLength(full.candles.length)
        expect(outputs[output.key]!.at(-1), `${type}.${output.key}`).not.toBeNull()
      }
    }
  })

  it('sem velas semanais nem séries externas, os indicadores que dependem delas ficam sem dado', () => {
    for (const type of INDICATOR_TYPES) {
      if (!INDICATORS[type].requires) continue
      const { outputs } = computeIndicator(
        { id: 'x', type, params: defaultParams(type), visible: true },
        candles,
      )
      for (const values of Object.values(outputs)) {
        expect(
          values.every((v) => v === null),
          type,
        ).toBe(true)
      }
    }
  })

  it('a fonte de preço muda o cálculo', () => {
    const close = computeIndicator(
      { id: 'a', type: 'sma', params: { ...defaultParams('sma'), period: 3 }, visible: true },
      candles,
    )
    const high = computeIndicator(
      {
        id: 'b',
        type: 'sma',
        params: { ...defaultParams('sma'), period: 3, source: 'high' },
        visible: true,
      },
      candles,
    )
    expect(high.outputs.value!.at(-1)! - close.outputs.value!.at(-1)!).toBeCloseTo(2, 8)
  })
})

describe('validação', () => {
  it('rejeita período fora da faixa, fracionário e não numérico', () => {
    expect(validateParams('ema', { ...defaultParams('ema'), period: 0 }).period).toMatch(/Entre/)
    expect(validateParams('ema', { ...defaultParams('ema'), period: 2.5 }).period).toMatch(
      /inteiro/,
    )
    expect(validateParams('ema', { ...defaultParams('ema'), period: Number.NaN }).period).toMatch(
      /número/,
    )
  })

  it('aceita multiplicador fracionário nas Bandas de Bollinger', () => {
    expect(validateParams('bb', { ...defaultParams('bb'), multiplier: 2.5 })).toEqual({})
  })

  it('MACD exige MME lenta maior que a rápida', () => {
    expect(validateParams('macd', { ...defaultParams('macd'), fast: 26, slow: 12 }).slow).toMatch(
      /maior/,
    )
  })

  it('IFR exige sobrevenda menor que sobrecompra', () => {
    expect(
      validateParams('rsi', { ...defaultParams('rsi'), upperLevel: 50, lowerLevel: 50 }).lowerLevel,
    ).toBeDefined()
  })

  it('rejeita cor inválida', () => {
    expect(validateParams('ema', { ...defaultParams('ema'), color: 'red' }).color).toBeDefined()
  })
})

describe('sanitizeParams', () => {
  it('completa parâmetros ausentes e descarta inválidos', () => {
    expect(sanitizeParams('ema', { period: 9, source: 'nope' })).toEqual({
      ...defaultParams('ema'),
      period: 9,
    })
  })

  it('volta ao padrão quando a combinação é inválida', () => {
    expect(sanitizeParams('macd', { fast: 30, slow: 10 })).toEqual(defaultParams('macd'))
  })

  it('aceita entrada que não é objeto', () => {
    expect(sanitizeParams('rsi', 'lixo')).toEqual(defaultParams('rsi'))
  })
})

describe('indicatorLabel', () => {
  it.each([
    ['ema', {}, 'MME 21'],
    ['sma', { source: 'hl2' }, 'MMS 50 (M+m)/2'],
    ['bb', { multiplier: 2.5 }, 'BB 20 2,5'],
    ['rsi', {}, 'IFR 14'],
    ['macd', {}, 'MACD 12 26 9'],
  ] as const)('%s', (type, overrides, expected) => {
    expect(indicatorLabel(type, { ...defaultParams(type), ...overrides })).toBe(expected)
  })
})
