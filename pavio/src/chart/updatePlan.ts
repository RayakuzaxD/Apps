import type { Candle } from '../domain/types'

export type UpdatePlan =
  | { kind: 'none' }
  /** Série nova (par/intervalo trocado): substitui dados e reposiciona a visão. */
  | { kind: 'reset' }
  /** Mesma série, dados recarregados: substitui dados mantendo zoom/rolagem. */
  | { kind: 'replace' }
  /** Só a ponta mudou: aplica `series.update` nos candles listados, em ordem. */
  | { kind: 'update'; candles: Candle[] }

/**
 * Decide como levar o gráfico de `prev` para `next` com o mínimo de trabalho.
 * Depende de `mergeCandle` preservar a identidade dos candles não alterados.
 */
export function planCandleUpdate(
  prevKey: string | null,
  prev: readonly Candle[],
  nextKey: string,
  next: readonly Candle[],
): UpdatePlan {
  if (prevKey !== nextKey) return { kind: 'reset' }
  if (prev === next) return { kind: 'none' }
  if (prev.length === 0 || next.length === 0) return { kind: 'replace' }

  const lastPrevIndex = prev.length - 1
  const added = next.length - prev.length
  const sameHead =
    added >= 0 &&
    added <= 2 &&
    next[0] === prev[0] &&
    next[lastPrevIndex]?.time === prev[lastPrevIndex]!.time &&
    (lastPrevIndex === 0 || next[lastPrevIndex - 1] === prev[lastPrevIndex - 1])

  if (!sameHead) return { kind: 'replace' }

  const changed = next.slice(lastPrevIndex).filter((c, i) => i > 0 || c !== prev[lastPrevIndex])
  return changed.length === 0 ? { kind: 'none' } : { kind: 'update', candles: changed }
}
