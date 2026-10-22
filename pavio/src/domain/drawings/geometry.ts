export interface Point {
  x: number
  y: number
}

/** Níveis da retração de Fibonacci. */
export const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const

export interface FibLevel {
  ratio: number
  price: number
}

/**
 * Preço de cada nível. O primeiro ponto marcado é o nível 1 e o segundo é o
 * nível 0: puxando de um fundo até um topo, os níveis medem a retração a
 * partir do topo.
 */
export function fibLevels(startPrice: number, endPrice: number): FibLevel[] {
  return FIB_RATIOS.map((ratio) => ({ ratio, price: endPrice + (startPrice - endPrice) * ratio }))
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Distância de `p` ao segmento `a`–`b`. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return distance(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy })
}

/** Distância de `p` à faixa horizontal em `y` entre `x1` e `x2`. */
export function distanceToHorizontalSegment(p: Point, y: number, x1: number, x2: number): number {
  return distanceToSegment(p, { x: Math.min(x1, x2), y }, { x: Math.max(x1, x2), y })
}
