import { describe, expect, it } from 'vitest'
import { hitTest, type ProjectedDrawing } from './hitTest'

const trend: ProjectedDrawing = {
  id: 't',
  kind: 'trend',
  points: [
    { x: 100, y: 100 },
    { x: 300, y: 200 },
  ],
}
const horizontal: ProjectedDrawing = { id: 'h', kind: 'horizontal', points: [{ x: 50, y: 400 }] }
const fib: ProjectedDrawing = {
  id: 'f',
  kind: 'fib',
  points: [
    { x: 500, y: 300 },
    { x: 700, y: 100 },
  ],
  levelYs: [100, 147.2, 176.4, 200, 223.6, 257.2, 300],
}
const all = [trend, horizontal, fib]

describe('hitTest', () => {
  it('acerta a linha de tendência perto do segmento e erra longe dele', () => {
    expect(hitTest(all, { x: 200, y: 152 }, null)).toEqual({ id: 't', part: 'body' })
    expect(hitTest(all, { x: 200, y: 170 }, null)).toBeNull()
    // Além da ponta (o segmento não é estendido).
    expect(hitTest(all, { x: 360, y: 230 }, null)).toBeNull()
  })

  it('linha horizontal ocupa toda a largura', () => {
    expect(hitTest(all, { x: 5, y: 404 }, null)).toEqual({ id: 'h', part: 'body' })
    expect(hitTest(all, { x: 900, y: 396 }, null)).toEqual({ id: 'h', part: 'body' })
    expect(hitTest(all, { x: 900, y: 410 }, null)).toBeNull()
  })

  it('Fibonacci acerta qualquer nível entre os pontos e a diagonal', () => {
    expect(hitTest(all, { x: 600, y: 225 }, null)).toEqual({ id: 'f', part: 'body' })
    expect(hitTest(all, { x: 650, y: 150 }, null)).toEqual({ id: 'f', part: 'body' })
    expect(hitTest(all, { x: 800, y: 200 }, null)).toBeNull()
    expect(hitTest(all, { x: 540, y: 190 }, null)).toBeNull()
  })

  it('alças só valem para o desenho selecionado', () => {
    expect(hitTest(all, { x: 304, y: 203 }, 't')).toEqual({ id: 't', part: 1 })
    expect(hitTest(all, { x: 304, y: 203 }, null)).toEqual({ id: 't', part: 'body' })
    expect(hitTest(all, { x: 503, y: 297 }, 'f')).toEqual({ id: 'f', part: 0 })
  })

  it('o desenho mais recente vence quando há sobreposição', () => {
    const crossing: ProjectedDrawing = { id: 'h2', kind: 'horizontal', points: [{ x: 0, y: 150 }] }
    expect(hitTest([trend, crossing], { x: 200, y: 150 }, null)).toEqual({ id: 'h2', part: 'body' })
  })
})
