import { describe, expect, it } from 'vitest'
import { describeLoadError, isAbortError } from './errors'
import { BinanceApiError } from './rest'

describe('describeLoadError', () => {
  it.each([
    [new BinanceApiError('Invalid symbol.', 400, -1121), /não existe/],
    [new BinanceApiError('restricted', 451), /bloqueou/],
    [new BinanceApiError('too many', 429), /Limite/],
    [new BinanceApiError('boom', 500), /boom/],
    [new TypeError('Failed to fetch'), /conexão/],
  ])('%s', (error, expected) => {
    expect(describeLoadError(error, 'XYZUSDT')).toMatch(expected)
  })
})

it('isAbortError reconhece abortos', () => {
  expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true)
  expect(isAbortError(new Error('x'))).toBe(false)
})
