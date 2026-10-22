import type { DrawingKind } from '../domain/drawings/types'

export const DRAWING_COLORS: Record<DrawingKind, string> = {
  trend: '#6366f1',
  horizontal: '#e8833a',
  fib: '#8b8579',
}

/** Cor de cada nível de Fibonacci (mesma ordem de FIB_RATIOS). */
export const FIB_LEVEL_COLORS = [
  '#8b8579',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b8579',
] as const

export const LINE_WIDTH = 2
export const HANDLE_RADIUS = 5
/** Distância máxima (px) para considerar o mouse sobre uma linha. */
export const HIT_TOLERANCE = 6
/** Distância máxima (px) para pegar uma alça de ponto. */
export const HANDLE_HIT_RADIUS = 9
