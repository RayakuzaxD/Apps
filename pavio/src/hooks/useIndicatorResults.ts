import { useMemo } from 'react'
import { computeIndicator, type IndicatorResult } from '../domain/indicators/registry'
import type { Candle } from '../domain/types'
import { useIndicatorsStore } from '../store/indicatorsStore'

/** Indicadores configurados calculados sobre os candles (compartilhado por gráfico e leitura). */
export function useIndicatorResults(candles: readonly Candle[]): IndicatorResult[] {
  const configs = useIndicatorsStore((s) => s.indicators)
  return useMemo(
    () => configs.map((config) => computeIndicator(config, candles)),
    [configs, candles],
  )
}
