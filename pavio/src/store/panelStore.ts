import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type PanelTab = 'reading' | 'watchlist'

export function isPanelTab(value: unknown): value is PanelTab {
  return value === 'reading' || value === 'watchlist'
}

/** Em telas estreitas o painel cobre o gráfico, então começa fechado. */
export function defaultPanelOpen(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return !window.matchMedia('(max-width: 900px)').matches
}

export interface PanelState {
  open: boolean
  tab: PanelTab
  setOpen: (open: boolean) => void
  setTab: (tab: PanelTab) => void
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      open: defaultPanelOpen(),
      tab: 'reading',
      setOpen: (open) => set({ open }),
      setTab: (tab) => set({ tab, open: true }),
    }),
    {
      name: 'pavio:panel',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ open, tab }) => ({ open, tab }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { open?: unknown; tab?: unknown }
        return {
          ...current,
          open: typeof p.open === 'boolean' ? p.open : current.open,
          tab: isPanelTab(p.tab) ? p.tab : current.tab,
        }
      },
    },
  ),
)
