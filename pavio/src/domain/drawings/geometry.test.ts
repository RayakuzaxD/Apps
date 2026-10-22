import { describe, expect, it } from 'vitest'
import { distanceToHorizontalSegment, distanceToSegment, fibLevels } from './geometry'

describe('fibLevels', () => {
  it('do fundo (100) ao topo (200): nível 0 no topo, 1 no fundo', () => {
    const levels = fibLevels(100, 200)
    expect(levels.map((l) => l.ratio)).toEqual([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1])
    expect(levels.map((l) => l.price)).toEqual(
      [200, 200 - 23.6, 200 - 38.2, 150, 200 - 61.8, 200 - 78.6, 100].map((v) =>
        expect.closeTo(v, 10),
      ),
    )
  })

  it('do topo ao fundo inverte a direção', () => {
    const levels = fibLevels(200, 100)
    expect(levels[0]!.price).toBe(100)
    expect(levels[6]!.price).toBe(200)
    expect(levels[4]!.price).toBeCloseTo(161.8, 10)
  })
})

describe('distanceToSegment', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 10, y: 0 }

  it('perpendicular ao meio do segmento', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, a, b)).toBe(3)
  })

  it('além das pontas mede até a ponta mais próxima', () => {
    expect(distanceToSegment({ x: 13, y: 4 }, a, b)).toBe(5)
    expect(distanceToSegment({ x: -3, y: -4 }, a, b)).toBe(5)
  })

  it('segmento degenerado (um ponto)', () => {
    expect(distanceToSegment({ x: 3, y: 4 }, a, a)).toBe(5)
  })

  it('segmento diagonal', () => {
    expect(distanceToSegment({ x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 10 })).toBeCloseTo(
      Math.SQRT2 * 5,
      10,
    )
  })
})

it('distanceToHorizontalSegment aceita x em qualquer ordem', () => {
  expect(distanceToHorizontalSegment({ x: 5, y: 12 }, 10, 10, 0)).toBe(2)
  expect(distanceToHorizontalSegment({ x: 20, y: 10 }, 10, 0, 10)).toBe(10)
})
