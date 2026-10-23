import { useMemo } from 'react'
import {
  INDICATORS,
  computeIndicator,
  type ComputeContext,
  type IndicatorConfig,
  type IndicatorRequirements,
  type IndicatorResult,
} from '../domain/indicators/registry'
import type { Candle } from '../domain/types'

/** O que os indicadores configurados precisam além das velas do gráfico. */
export function collectRequirements(
  configs: readonly IndicatorConfig[],
): Required<IndicatorRequirements> {
  const external = new Set<string>()
  let weekly = false
  let monthly = false
  for (const config of configs) {
    const req = INDICATORS[config.type].requires
    if (!req) continue
    weekly ||= req.weekly === true
    monthly ||= req.monthly === true
    for (const id of req.external ?? []) external.add(id)
  }
  return { weekly, monthly, external: [...external].sort() }
}

interface CacheEntry {
  times: string
  data: ComputeContext
  result: IndicatorResult
}

/** Resultado reaproveitável por configuração (a store troca o objeto a cada edição). */
const reusable = new WeakMap<IndicatorConfig, CacheEntry>()

/**
 * Indicadores configurados calculados sobre as velas (compartilhado por gráfico
 * e leitura). Indicadores de séries externas (`usesPrice: false`) não dependem
 * do preço: o resultado é reaproveitado enquanto as velas não mudam de horário,
 * o que evita recalcular e redesenhar a cada tick.
 */
export function useIndicatorResults(
  configs: readonly IndicatorConfig[],
  candles: readonly Candle[],
  data: ComputeContext,
): IndicatorResult[] {
  return useMemo(() => {
    const times = `${candles.length}:${candles[0]?.time}:${candles[candles.length - 1]?.time}`
    return configs.map((config) => {
      if (INDICATORS[config.type].usesPrice !== false)
        return computeIndicator(config, candles, data)
      const hit = reusable.get(config)
      if (
        hit &&
        hit.times === times &&
        hit.data.external === data.external &&
        hit.data.symbol === data.symbol &&
        hit.data.interval === data.interval
      ) {
        return hit.result
      }
      const result = computeIndicator(config, candles, data)
      reusable.set(config, { times, data, result })
      return result
    })
  }, [configs, candles, data])
}
