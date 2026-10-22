import { describe, expect, it } from 'vitest'
import { makeKlineEvent, makeRestKlines } from '../../../tests/fixtures/klines'
import { klineStreamName, parseKlineEvent, parseRestKline } from './mappers'

describe('parseRestKline', () => {
  it('converte a linha da API em Candle com tempo em segundos', () => {
    const row = makeRestKlines(1, { startMs: 1_700_000_000_000 })[0]
    const candle = parseRestKline(row)
    expect(candle.time).toBe(1_700_000_000)
    expect(candle.open).toBe(Number(row![1]))
    expect(candle.close).toBe(Number(row![4]))
    expect(candle.volume).toBe(Number(row![5]))
  })

  it('rejeita formatos inválidos', () => {
    expect(() => parseRestKline({})).toThrow()
    expect(() => parseRestKline([1, 'x', '1', '1', '1', '1'])).toThrow()
  })
})

describe('parseKlineEvent', () => {
  it('lê evento de kline', () => {
    const candle = { time: 1_700_000_040, open: 1, high: 3, low: 0.5, close: 2, volume: 7 }
    const event = parseKlineEvent(makeKlineEvent('BTCUSDT', '1m', candle, true))
    expect(event).toEqual({ symbol: 'BTCUSDT', interval: '1m', isClosed: true, candle })
  })

  it('ignora outras mensagens', () => {
    expect(parseKlineEvent({ result: null, id: 1 })).toBeNull()
    expect(parseKlineEvent(null)).toBeNull()
  })
})

it('monta o nome do stream em minúsculas', () => {
  expect(klineStreamName('BTCUSDT', '1h')).toBe('btcusdt@kline_1h')
})
