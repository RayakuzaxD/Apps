import { beforeEach, describe, expect, it } from 'vitest'
import { defaultParams } from '../domain/indicators/registry'
import { MAX_INDICATORS, sanitizeIndicators, useIndicatorsStore } from './indicatorsStore'

const store = () => useIndicatorsStore.getState()

describe('useIndicatorsStore', () => {
  beforeEach(() => useIndicatorsStore.setState({ indicators: [] }))

  it('adiciona várias instâncias com ids únicos e parâmetros padrão', () => {
    const a = store().add('ema')
    const b = store().add('ema')
    expect(a).not.toBe(b)
    expect(store().indicators).toEqual([
      { id: a, type: 'ema', params: defaultParams('ema'), visible: true },
      { id: b, type: 'ema', params: defaultParams('ema'), visible: true },
    ])
  })

  it('edita parâmetros, alterna visibilidade e remove', () => {
    const id = store().add('rsi')!
    store().update(id, { ...defaultParams('rsi'), period: 7 })
    expect(store().indicators[0]!.params.period).toBe(7)

    store().toggle(id)
    expect(store().indicators[0]!.visible).toBe(false)

    store().remove(id)
    expect(store().indicators).toEqual([])
  })

  it('não aceita parâmetros inválidos na edição', () => {
    const id = store().add('macd')!
    store().update(id, { ...defaultParams('macd'), fast: 40, slow: 10 })
    expect(store().indicators[0]!.params).toEqual(defaultParams('macd'))
  })

  it('limita a quantidade de indicadores', () => {
    for (let i = 0; i < MAX_INDICATORS; i++) store().add('sma')
    expect(store().add('sma')).toBeNull()
    expect(store().indicators).toHaveLength(MAX_INDICATORS)
  })

  it('persiste no localStorage', () => {
    store().add('bb')
    const saved = JSON.parse(localStorage.getItem('pavio:indicators') ?? '{}')
    expect(saved.state.indicators).toHaveLength(1)
    expect(saved.state.indicators[0].type).toBe('bb')
  })
})

describe('sanitizeIndicators', () => {
  it('descarta itens inválidos, duplicados e corrige parâmetros', () => {
    expect(
      sanitizeIndicators([
        { id: 'a', type: 'ema', params: { period: 9 } },
        { id: 'a', type: 'sma', params: {} },
        { id: 'b', type: 'nope', params: {} },
        { type: 'rsi' },
        'lixo',
        { id: 'c', type: 'rsi', params: {}, visible: false },
      ]),
    ).toEqual([
      { id: 'a', type: 'ema', params: { ...defaultParams('ema'), period: 9 }, visible: true },
      { id: 'c', type: 'rsi', params: defaultParams('rsi'), visible: false },
    ])
  })

  it('aceita entrada que não é lista', () => {
    expect(sanitizeIndicators(null)).toEqual([])
  })
})
