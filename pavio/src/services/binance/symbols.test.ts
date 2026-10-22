import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BinanceApiError } from './rest'
import { explainLoadError, fetchSymbolSet, resetSymbolSetCache } from './symbols'

const list = () =>
  Response.json([
    { symbol: 'BTCUSDT', price: '1' },
    { symbol: 'ETHUSDT', price: '1' },
  ])

describe('fetchSymbolSet', () => {
  beforeEach(() => resetSymbolSetCache())

  it('carrega uma vez e reaproveita', async () => {
    const fetchImpl = vi.fn(async () => list())
    const a = await fetchSymbolSet({ baseUrl: 'https://x.test', fetchImpl })
    const b = await fetchSymbolSet({ fetchImpl })
    expect(a).toBe(b)
    expect([...a]).toEqual(['BTCUSDT', 'ETHUSDT'])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith('https://x.test/api/v3/ticker/price')
  })

  it('não guarda falha em cache', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(list())
    await expect(fetchSymbolSet({ fetchImpl })).rejects.toThrow()
    await expect(fetchSymbolSet({ fetchImpl })).resolves.toHaveProperty('size', 2)
  })
})

describe('explainLoadError', () => {
  beforeEach(() => resetSymbolSetCache())
  const network = new TypeError('Failed to fetch')

  it('erro de rede para par inexistente vira "par inválido" (-1121)', async () => {
    const result = await explainLoadError(network, 'NOPEUSDT', { fetchImpl: async () => list() })
    expect(result).toBeInstanceOf(BinanceApiError)
    expect(result).toMatchObject({ code: -1121 })
  })

  it('erro de rede para par existente continua erro de rede', async () => {
    expect(await explainLoadError(network, 'BTCUSDT', { fetchImpl: async () => list() })).toBe(
      network,
    )
  })

  it('sem conseguir a lista, mantém o erro original', async () => {
    const fetchImpl = async () => {
      throw new TypeError('offline')
    }
    expect(await explainLoadError(network, 'NOPEUSDT', { fetchImpl })).toBe(network)
  })

  it('erros que não são de rede passam direto, sem consultar a lista', async () => {
    const fetchImpl = vi.fn()
    const apiError = new BinanceApiError('boom', 500)
    expect(await explainLoadError(apiError, 'X', { fetchImpl })).toBe(apiError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
