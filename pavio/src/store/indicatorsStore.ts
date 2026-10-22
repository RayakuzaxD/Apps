import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  defaultParams,
  isIndicatorType,
  sanitizeParams,
  type IndicatorConfig,
  type IndicatorParams,
  type IndicatorType,
} from '../domain/indicators/registry'

export const MAX_INDICATORS = 12

export interface IndicatorsState {
  indicators: IndicatorConfig[]
  add: (type: IndicatorType) => string | null
  update: (id: string, params: IndicatorParams) => void
  toggle: (id: string) => void
  remove: (id: string) => void
}

let counter = 0
function newId(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter.toString(36)}`
}

/** Valida a lista vinda do localStorage, descartando entradas inválidas. */
export function sanitizeIndicators(raw: unknown): IndicatorConfig[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const result: IndicatorConfig[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const { id, type, params, visible } = item as Record<string, unknown>
    if (typeof id !== 'string' || !id || seen.has(id) || !isIndicatorType(type)) continue
    seen.add(id)
    result.push({ id, type, params: sanitizeParams(type, params), visible: visible !== false })
  }
  return result.slice(0, MAX_INDICATORS)
}

export const useIndicatorsStore = create<IndicatorsState>()(
  persist(
    (set, get) => ({
      indicators: [],
      add: (type) => {
        if (get().indicators.length >= MAX_INDICATORS) return null
        const id = newId()
        set((s) => ({
          indicators: [...s.indicators, { id, type, params: defaultParams(type), visible: true }],
        }))
        return id
      },
      update: (id, params) =>
        set((s) => ({
          indicators: s.indicators.map((i) =>
            i.id === id ? { ...i, params: sanitizeParams(i.type, params) } : i,
          ),
        })),
      toggle: (id) =>
        set((s) => ({
          indicators: s.indicators.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)),
        })),
      remove: (id) => set((s) => ({ indicators: s.indicators.filter((i) => i.id !== id) })),
    }),
    {
      name: 'pavio:indicators',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ indicators }) => ({ indicators }),
      merge: (persisted, current) => ({
        ...current,
        indicators: sanitizeIndicators((persisted as { indicators?: unknown } | null)?.indicators),
      }),
    },
  ),
)
