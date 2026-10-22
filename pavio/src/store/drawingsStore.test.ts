import { beforeEach, describe, expect, it } from 'vitest'
import { sanitizeDrawings, useDrawingsStore } from './drawingsStore'

const store = () => useDrawingsStore.getState()
const p = (time: number, price: number) => ({ time, price })

describe('useDrawingsStore', () => {
  beforeEach(() => useDrawingsStore.setState({ drawings: [], tool: 'cursor', selectedId: null }))

  it('adiciona desenhos com a quantidade certa de pontos', () => {
    expect(store().add('BTCUSDT', 'trend', [p(1, 10), p(2, 20)])).toBeTruthy()
    expect(store().add('BTCUSDT', 'horizontal', [p(1, 10)])).toBeTruthy()
    expect(store().add('BTCUSDT', 'fib', [p(1, 10)])).toBeNull()
    expect(store().add('BTCUSDT', 'horizontal', [p(1, 10), p(2, 20)])).toBeNull()
    expect(store().drawings.map((d) => d.kind)).toEqual(['trend', 'horizontal'])
  })

  it('move pontos, seleciona e remove (limpando a seleção)', () => {
    const id = store().add('BTCUSDT', 'trend', [p(1, 10), p(2, 20)])!
    store().movePoints(id, [p(3, 30), p(4, 40)])
    expect(store().drawings[0]!.points).toEqual([p(3, 30), p(4, 40)])

    store().select(id)
    expect(store().selectedId).toBe(id)
    store().remove(id)
    expect(store().drawings).toEqual([])
    expect(store().selectedId).toBeNull()
  })

  it('ignora movimento com pontos inválidos', () => {
    const id = store().add('BTCUSDT', 'trend', [p(1, 10), p(2, 20)])!
    store().movePoints(id, [p(3, Number.NaN), p(4, 40)])
    expect(store().drawings[0]!.points).toEqual([p(1, 10), p(2, 20)])
  })

  it('trocar de ferramenta limpa a seleção', () => {
    store().select('x')
    store().setTool('fib')
    expect(store()).toMatchObject({ tool: 'fib', selectedId: null })
  })

  it('remove todos os desenhos de um par, preservando os outros', () => {
    store().add('BTCUSDT', 'horizontal', [p(1, 10)])
    store().add('ETHUSDT', 'horizontal', [p(1, 10)])
    store().removeAllForSymbol('BTCUSDT')
    expect(store().drawings.map((d) => d.symbol)).toEqual(['ETHUSDT'])
  })

  it('persiste só os desenhos (não a ferramenta)', () => {
    store().setTool('trend')
    store().add('BTCUSDT', 'horizontal', [p(1, 10)])
    const saved = JSON.parse(localStorage.getItem('pavio:drawings') ?? '{}')
    expect(Object.keys(saved.state)).toEqual(['drawings'])
    expect(saved.state.drawings).toHaveLength(1)
  })
})

describe('sanitizeDrawings', () => {
  it('descarta itens inválidos e duplicados', () => {
    expect(
      sanitizeDrawings([
        { id: 'a', symbol: 'BTCUSDT', kind: 'trend', points: [p(1, 1), p(2, 2)], extra: true },
        { id: 'a', symbol: 'BTCUSDT', kind: 'horizontal', points: [p(1, 1)] },
        { id: 'b', symbol: 'BTCUSDT', kind: 'circle', points: [p(1, 1)] },
        { id: 'c', symbol: 'BTCUSDT', kind: 'fib', points: [p(1, 1)] },
        { id: 'd', symbol: '', kind: 'horizontal', points: [p(1, 1)] },
        { id: 'e', symbol: 'BTCUSDT', kind: 'horizontal', points: [{ time: 'x', price: 1 }] },
        null,
      ]),
    ).toEqual([{ id: 'a', symbol: 'BTCUSDT', kind: 'trend', points: [p(1, 1), p(2, 2)] }])
  })

  it('aceita entrada que não é lista', () => {
    expect(sanitizeDrawings({})).toEqual([])
  })
})
