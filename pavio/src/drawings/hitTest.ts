import {
  distance,
  distanceToHorizontalSegment,
  distanceToSegment,
  type Point,
} from '../domain/drawings/geometry'
import type { DrawingKind } from '../domain/drawings/types'
import { HANDLE_HIT_RADIUS, HIT_TOLERANCE } from './style'

/** Desenho já projetado em pixels do painel principal. */
export interface ProjectedDrawing {
  id: string
  kind: DrawingKind
  /** Pontos em pixels, na mesma ordem dos pontos do desenho. */
  points: Point[]
  /** Fibonacci: coordenada y de cada nível. */
  levelYs?: number[]
}

export interface Hit {
  id: string
  /** Índice do ponto (alça) ou `body` para o desenho inteiro. */
  part: number | 'body'
}

function bodyDistance(d: ProjectedDrawing, p: Point): number {
  const [a, b] = d.points
  if (!a) return Infinity
  switch (d.kind) {
    case 'horizontal':
      return Math.abs(p.y - a.y)
    case 'trend':
      return b ? distanceToSegment(p, a, b) : Infinity
    case 'fib': {
      if (!b) return Infinity
      const levels = (d.levelYs ?? []).map((y) => distanceToHorizontalSegment(p, y, a.x, b.x))
      return Math.min(distanceToSegment(p, a, b), ...levels)
    }
  }
}

/**
 * Encontra o que está sob `p`. Alças do desenho selecionado têm prioridade;
 * entre desenhos sobrepostos, vence o mais recente (desenhado por cima).
 */
export function hitTest(
  drawings: readonly ProjectedDrawing[],
  p: Point,
  selectedId: string | null,
): Hit | null {
  const selected = drawings.find((d) => d.id === selectedId)
  if (selected) {
    const handle = selected.points.findIndex((pt) => distance(pt, p) <= HANDLE_HIT_RADIUS)
    if (handle !== -1) return { id: selected.id, part: handle }
  }
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i]!
    if (bodyDistance(d, p) <= HIT_TOLERANCE) return { id: d.id, part: 'body' }
  }
  return null
}
