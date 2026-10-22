import { describe, expect, it } from 'vitest'
import { bollinger, ema, macd, rsi, sma, type Series } from './math'

/** Compara séries numéricas com tolerância (`digits` casas decimais), nulls exatos. */
function expectSeries(actual: Series, expected: (number | null)[], digits = 4) {
  expect(actual).toHaveLength(expected.length)
  expected.forEach((value, i) => {
    if (value === null) expect(actual[i], `índice ${i}`).toBeNull()
    else expect(actual[i], `índice ${i}`).toBeCloseTo(value, digits)
  })
}

describe('sma', () => {
  it('média dos últimos N valores', () => {
    expectSeries(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4])
  })

  it('período 1 devolve a própria série', () => {
    expectSeries(sma([5, 7, 9], 1), [5, 7, 9])
  })

  it('período maior que os dados resulta em nulls', () => {
    expectSeries(sma([1, 2], 5), [null, null])
  })

  it('ignora nulls iniciais', () => {
    expectSeries(sma([null, null, 2, 4, 6], 2), [null, null, null, 3, 5])
  })
})

describe('ema', () => {
  // Exemplo clássico de MME de 10 períodos (StockCharts, valores arredondados em 2 casas).
  const closes = [
    22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29, 22.15, 22.39, 22.38,
    22.61, 23.36, 24.05, 23.75, 23.83, 23.95, 23.63, 23.82, 23.87, 23.65, 23.19, 23.1, 23.33, 22.68,
    23.1, 22.4, 22.17,
  ]
  const expected = [
    22.22, 22.21, 22.24, 22.27, 22.33, 22.52, 22.8, 22.97, 23.13, 23.28, 23.34, 23.43, 23.51, 23.54,
    23.47, 23.4, 23.39, 23.26, 23.23, 23.08, 22.92,
  ]

  // A tabela de referência arredonda cada passo em 2 casas e propaga o arredondamento,
  // por isso a tolerância é um pouco maior que meio centavo.
  it('bate com a tabela de referência', () => {
    const result = ema(closes, 10)
    expectSeries(result.slice(0, 9), new Array(9).fill(null))
    expected.forEach((value, i) => {
      expect(Math.abs(result[i + 9]! - value), `dia ${i + 10}`).toBeLessThanOrEqual(0.007)
    })
  })

  it('é semeada pela média simples', () => {
    expectSeries(ema([2, 4, 6, 8], 3), [null, null, 4, 6])
  })

  it('período maior que os dados resulta em nulls', () => {
    expectSeries(ema([1, 2, 3], 4), [null, null, null])
  })
})

describe('rsi', () => {
  // Exemplo clássico de IFR 14 (StockCharts).
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28,
    46.28, 46.0, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18,
    44.22, 44.57, 43.42, 42.66, 43.13,
  ]
  const expected = [
    70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93, 63.26, 56.06, 62.38, 54.71, 50.42, 39.99,
    41.46, 41.87, 45.46, 37.3, 33.08, 37.77,
  ]

  // A tabela de referência usa médias iniciais arredondadas; sem arredondar, o primeiro
  // valor é 70,46 (o valor normalmente citado): ganhos 3,34/14 e perdas 1,40/14 dão
  // RS = 2,3857 e IFR = 70,464. A diferença para a tabela diminui ao longo da série.
  it('bate com a tabela de referência (suavização de Wilder)', () => {
    const result = rsi(closes, 14)
    expectSeries(result.slice(0, 14), new Array(14).fill(null))
    expect(result[14]).toBeCloseTo(70.464, 3)
    expected.forEach((value, i) => {
      expect(Math.abs(result[i + 14]! - value), `dia ${i + 15}`).toBeLessThanOrEqual(0.08)
    })
  })

  it('só altas = 100, só baixas = 0, sem variação = 50', () => {
    expect(rsi([1, 2, 3, 4], 3)[3]).toBe(100)
    expect(rsi([4, 3, 2, 1], 3)[3]).toBe(0)
    expect(rsi([2, 2, 2, 2], 3)[3]).toBe(50)
  })

  it('fica entre 0 e 100', () => {
    const values = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 3) * 10 + (i % 7))
    for (const v of rsi(values, 14)) if (v !== null) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of rsi(values, 14)) if (v !== null) expect(v).toBeLessThanOrEqual(100)
  })

  it('dados insuficientes resultam em nulls', () => {
    expectSeries(rsi([1, 2, 3], 3), [null, null, null])
  })
})

describe('macd', () => {
  it('calcula linha, sinal e histograma (exemplo feito à mão)', () => {
    const { macd: line, signal, histogram } = macd([1, 3, 2, 5, 4, 6], 2, 3, 2)
    expectSeries(line, [null, null, 0, 0.5, 0.25, 0.458333])
    expectSeries(signal, [null, null, null, 0.25, 0.25, 0.388889])
    expectSeries(histogram, [null, null, null, 0.25, 0, 0.069444])
  })

  it('com parâmetros padrão (12, 26, 9) o primeiro valor sai no índice certo', () => {
    const values = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 5)
    const { macd: line, signal, histogram } = macd(values, 12, 26, 9)
    expect(line.findIndex((v) => v !== null)).toBe(25)
    expect(signal.findIndex((v) => v !== null)).toBe(33)
    expect(histogram.findIndex((v) => v !== null)).toBe(33)
    const e12 = ema(values, 12)
    const e26 = ema(values, 26)
    expect(line[40]).toBeCloseTo(e12[40]! - e26[40]!, 10)
    expect(histogram[40]).toBeCloseTo(line[40]! - signal[40]!, 10)
  })
})

describe('bollinger', () => {
  it('MMS ± k × desvio padrão populacional', () => {
    const { middle, upper, lower } = bollinger([1, 2, 3, 4, 5], 3, 2)
    const dev = 2 * Math.sqrt(2 / 3)
    expectSeries(middle, [null, null, 2, 3, 4])
    expectSeries(upper, [null, null, 2 + dev, 3 + dev, 4 + dev])
    expectSeries(lower, [null, null, 2 - dev, 3 - dev, 4 - dev])
  })

  it('série constante tem bandas coladas na média', () => {
    const { upper, lower } = bollinger([5, 5, 5, 5], 2, 2)
    expectSeries(upper, [null, 5, 5, 5])
    expectSeries(lower, [null, 5, 5, 5])
  })
})
