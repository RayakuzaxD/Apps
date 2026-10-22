import { describe, expect, it } from 'vitest'
import { formatSymbol, isValidSymbol, normalizeSymbol, splitSymbol } from './symbols'

describe('símbolos', () => {
  it('normaliza entrada do usuário', () => {
    expect(normalizeSymbol(' btc/usdt ')).toBe('BTCUSDT')
    expect(normalizeSymbol('eth-usdc')).toBe('ETHUSDC')
  })

  it('valida formato', () => {
    expect(isValidSymbol('BTCUSDT')).toBe(true)
    expect(isValidSymbol('BTC')).toBe(false)
    expect(isValidSymbol('btcusdt')).toBe(false)
  })

  it('separa base e quote', () => {
    expect(splitSymbol('BTCUSDT')).toEqual({ base: 'BTC', quote: 'USDT' })
    expect(splitSymbol('ETHBTC')).toEqual({ base: 'ETH', quote: 'BTC' })
    expect(splitSymbol('USDCFDUSD')).toEqual({ base: 'USDC', quote: 'FDUSD' })
    expect(splitSymbol('XYZABC')).toEqual({ base: 'XYZABC', quote: '' })
  })

  it('formata para exibição', () => {
    expect(formatSymbol('SOLUSDT')).toBe('SOL/USDT')
  })
})
