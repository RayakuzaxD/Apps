import { describe, expect, it } from 'vitest'
import { fullContext } from '../../../tests/fixtures/indicatorContext'
import type { Series } from './math'
import {
  percentileRank,
  readBollinger,
  readMacd,
  readOscillator,
  readPriceVsLine,
  valueAt,
} from './readings'
import {
  INDICATORS,
  INDICATOR_TYPES,
  PACKS,
  computeIndicator,
  defaultParams,
  readIndicator,
} from './registry'

describe('leituras', () => {
  it('oscilador: topo, meio e fundo pelos cortes', () => {
    expect(readOscillator(75.5, 30, 70)).toMatchObject({
      value: '75,50',
      zone: 'topo',
      tone: 'top',
    })
    expect(readOscillator(70, 30, 70).zone).toBe('topo')
    expect(readOscillator(50, 30, 70)).toMatchObject({ zone: 'meio', tone: 'middle' })
    expect(readOscillator(30, 30, 70)).toMatchObject({ zone: 'fundo', tone: 'bottom' })
    expect(readOscillator(50, 30, 70).detail).toBe('Entre 30 (sobrevenda) e 70 (sobrecompra).')
  })

  it('preço contra uma linha', () => {
    expect(readPriceVsLine(110, 100, 'da MMS 50', 2)).toEqual({
      value: '100,00',
      zone: 'acima',
      tone: 'above',
      detail: 'Preço 10,00% acima da MMS 50.',
    })
    expect(readPriceVsLine(90, 100, 'do Preço Realizado', 2)).toMatchObject({
      zone: 'abaixo',
      tone: 'below',
    })
  })

  it('percentil e valor nulo', () => {
    expect(percentileRank(5, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(45)
    expect(percentileRank(3, [3, 3, 3])).toBe(50)
    expect(percentileRank(1, [])).toBe(50)
    expect(valueAt([1, null, Number.NaN], 1)).toBeNull()
    expect(valueAt([1, null, Number.NaN], 2)).toBeNull()
    expect(valueAt(undefined, 0)).toBeNull()
  })

  describe('Bollinger', () => {
    // Largura caindo ao longo do tempo: a última é a menor (bandas estreitas).
    const n = 50
    const middle: Series = Array.from({ length: n }, () => 100)
    const upper: Series = middle.map((m, i) => m! + (n - i))
    const lower: Series = middle.map((m, i) => m! - (n - i))

    it('bandas estreitas e preço dentro', () => {
      const r = readBollinger(100, upper, middle, lower, n - 1)!
      expect(r.tone).toBe('attention')
      expect(r.zone).toBe('dentro · estreitas')
      expect(r.value).toBe('largura 2,00%')
      expect(r.detail).toContain('50% do caminho')
      expect(r.detail).toContain('aperto costuma anteceder movimento forte')
    })

    it('preço acima ou abaixo das bandas com largura comum', () => {
      const flat: Series = Array.from({ length: n }, () => 10)
      const up = middle.map((m, i) => m! + flat[i]!)
      const lo = middle.map((m, i) => m! - flat[i]!)
      expect(readBollinger(120, up, middle, lo, n - 1)).toMatchObject({
        zone: 'acima da banda',
        tone: 'top',
      })
      expect(readBollinger(80, up, middle, lo, n - 1)).toMatchObject({
        zone: 'abaixo da banda',
        tone: 'bottom',
      })
    })

    it('sem dado devolve null', () => {
      expect(readBollinger(100, [null], [null], [null], 0)).toBeNull()
    })
  })

  it('MACD contra sinal e zero', () => {
    expect(readMacd(5, 3)).toMatchObject({ zone: 'acima do sinal', tone: 'above' })
    expect(readMacd(-2, -1).detail).toBe(
      'MACD abaixo da linha de sinal (histograma -1,00) e abaixo de zero.',
    )
  })
})

describe('registro: pacotes, textos e leituras', () => {
  // Velas diárias + semanais, mensais e séries externas sintéticas: todos os indicadores calculam.
  const { candles, data } = fullContext()

  it('todo indicador tem pacote existente e textos de "o que é" e "como ler"', () => {
    const packs = new Set(PACKS.map((p) => p.id))
    for (const type of INDICATOR_TYPES) {
      const def = INDICATORS[type]
      expect(packs.has(def.pack), type).toBe(true)
      expect(def.about.what.length, type).toBeGreaterThan(20)
      expect(def.about.howToRead.length, type).toBeGreaterThan(20)
    }
  })

  it('todo indicador tem leitura com dados suficientes e "sem dado" (null) sem eles', () => {
    for (const type of INDICATOR_TYPES) {
      const config = { id: type, type, params: defaultParams(type), visible: true }
      const result = computeIndicator(config, candles, data)
      expect(readIndicator(result, candles, 2, candles.length - 1, data), type).not.toBeNull()
      // Poucas velas e nenhum dado extra: sem dado.
      const few = candles.slice(0, 2)
      expect(readIndicator(computeIndicator(config, few), few, 2), type).toBeNull()
    }
    expect(
      readIndicator(
        computeIndicator({ id: 'x', type: 'rsi', params: defaultParams('rsi'), visible: true }, []),
        [],
        2,
      ),
    ).toBeNull()
  })

  it('nenhum texto recomenda comprar ou vender', () => {
    const forbidden = /\b(compre|comprar|compra|venda|vender|vende|venda já)\b/i
    const texts: string[] = PACKS.flatMap((p) => [p.name, p.description])
    for (const type of INDICATOR_TYPES) {
      const def = INDICATORS[type]
      texts.push(def.name, def.description, def.about.what, def.about.howToRead)
      const result = computeIndicator(
        {
          id: type,
          type,
          params: { ...defaultParams(type), ...(type === 'gli' ? { offsetDays: 30 } : {}) },
          visible: true,
        },
        candles,
        data,
      )
      for (let i = 0; i < candles.length; i++) {
        const r = readIndicator(result, candles, 2, i, data)
        if (r) texts.push(r.value, r.zone, r.detail)
      }
    }
    for (const text of texts) expect(text, text).not.toMatch(forbidden)
  })
})
