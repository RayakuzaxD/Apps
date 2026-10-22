export type DrawingKind = 'trend' | 'horizontal' | 'fib'

/** Ferramenta ativa: `cursor` seleciona/move; as demais criam desenhos. */
export type DrawingTool = 'cursor' | DrawingKind

/** Ponto ancorado no tempo (segundos UTC, horário real do candle) e no preço. */
export interface AnchorPoint {
  time: number
  price: number
}

export interface Drawing {
  id: string
  symbol: string
  kind: DrawingKind
  /** trend e fib: 2 pontos; horizontal: 1 ponto (só o preço importa). */
  points: AnchorPoint[]
}

export const POINTS_PER_KIND: Record<DrawingKind, number> = {
  trend: 2,
  horizontal: 1,
  fib: 2,
}

export const DRAWING_LABELS: Record<DrawingKind, string> = {
  trend: 'Linha de tendência',
  horizontal: 'Linha horizontal',
  fib: 'Retração de Fibonacci',
}
