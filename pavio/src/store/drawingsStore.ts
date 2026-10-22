import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  POINTS_PER_KIND,
  type AnchorPoint,
  type Drawing,
  type DrawingKind,
  type DrawingTool,
} from '../domain/drawings/types'

export const MAX_DRAWINGS = 500

export interface DrawingsState {
  drawings: Drawing[]
  /** Estado de interface (não persistido). */
  tool: DrawingTool
  selectedId: string | null
  setTool: (tool: DrawingTool) => void
  select: (id: string | null) => void
  add: (symbol: string, kind: DrawingKind, points: AnchorPoint[]) => string | null
  movePoints: (id: string, points: AnchorPoint[]) => void
  remove: (id: string) => void
  removeAllForSymbol: (symbol: string) => void
}

let counter = 0
function newId(): string {
  counter += 1
  return `d-${Date.now().toString(36)}-${counter.toString(36)}`
}

function isPoint(value: unknown): value is AnchorPoint {
  if (typeof value !== 'object' || value === null) return false
  const { time, price } = value as Record<string, unknown>
  return (
    typeof time === 'number' &&
    Number.isFinite(time) &&
    typeof price === 'number' &&
    Number.isFinite(price)
  )
}

function validPoints(kind: DrawingKind, points: unknown): points is AnchorPoint[] {
  return Array.isArray(points) && points.length === POINTS_PER_KIND[kind] && points.every(isPoint)
}

function isKind(value: unknown): value is DrawingKind {
  return typeof value === 'string' && value in POINTS_PER_KIND
}

/** Valida a lista vinda do localStorage, descartando entradas inválidas. */
export function sanitizeDrawings(raw: unknown): Drawing[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const result: Drawing[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const { id, symbol, kind, points } = item as Record<string, unknown>
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    if (typeof symbol !== 'string' || !symbol || !isKind(kind) || !validPoints(kind, points)) {
      continue
    }
    seen.add(id)
    result.push({ id, symbol, kind, points: points.map(({ time, price }) => ({ time, price })) })
  }
  return result.slice(-MAX_DRAWINGS)
}

export const useDrawingsStore = create<DrawingsState>()(
  persist(
    (set, get) => ({
      drawings: [],
      tool: 'cursor',
      selectedId: null,
      setTool: (tool) => set({ tool, selectedId: null }),
      select: (selectedId) => set({ selectedId }),
      add: (symbol, kind, points) => {
        if (!validPoints(kind, points) || get().drawings.length >= MAX_DRAWINGS) return null
        const id = newId()
        set((s) => ({ drawings: [...s.drawings, { id, symbol, kind, points }] }))
        return id
      },
      movePoints: (id, points) =>
        set((s) => ({
          drawings: s.drawings.map((d) =>
            d.id === id && validPoints(d.kind, points) ? { ...d, points } : d,
          ),
        })),
      remove: (id) =>
        set((s) => ({
          drawings: s.drawings.filter((d) => d.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        })),
      removeAllForSymbol: (symbol) =>
        set((s) => ({
          drawings: s.drawings.filter((d) => d.symbol !== symbol),
          selectedId: null,
        })),
    }),
    {
      name: 'pavio:drawings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ drawings }) => ({ drawings }),
      merge: (persisted, current) => ({
        ...current,
        drawings: sanitizeDrawings((persisted as { drawings?: unknown } | null)?.drawings),
      }),
    },
  ),
)
