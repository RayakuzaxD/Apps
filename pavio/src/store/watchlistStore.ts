import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { isValidSymbol } from '../domain/symbols'

export const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT']
export const MAX_WATCHLIST = 50

export interface WatchlistState {
  symbols: string[]
  open: boolean
  add: (symbol: string) => boolean
  remove: (symbol: string) => void
  setOpen: (open: boolean) => void
}

/** Valida o que vem do localStorage: formato, duplicados e limite. */
export function sanitizeWatchlist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_WATCHLIST
  const unique = [
    ...new Set(raw.filter((s): s is string => typeof s === 'string' && isValidSymbol(s))),
  ]
  return unique.slice(0, MAX_WATCHLIST)
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      symbols: DEFAULT_WATCHLIST,
      open: true,
      add: (symbol) => {
        const { symbols } = get()
        if (!isValidSymbol(symbol) || symbols.includes(symbol) || symbols.length >= MAX_WATCHLIST) {
          return false
        }
        set({ symbols: [...symbols, symbol] })
        return true
      },
      remove: (symbol) => set((s) => ({ symbols: s.symbols.filter((x) => x !== symbol) })),
      setOpen: (open) => set({ open }),
    }),
    {
      name: 'pavio:watchlist',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ symbols, open }) => ({ symbols, open }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { symbols?: unknown; open?: unknown }
        return {
          ...current,
          symbols: p.symbols === undefined ? current.symbols : sanitizeWatchlist(p.symbols),
          open: typeof p.open === 'boolean' ? p.open : current.open,
        }
      },
    },
  ),
)
