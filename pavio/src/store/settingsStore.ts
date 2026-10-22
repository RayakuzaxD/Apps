import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_INTERVAL, isIntervalId } from '../domain/intervals'
import { DEFAULT_SYMBOL, isValidSymbol } from '../domain/symbols'
import type { IntervalId } from '../domain/types'

export interface SettingsState {
  symbol: string
  interval: IntervalId
  setSymbol: (symbol: string) => void
  setInterval: (interval: IntervalId) => void
}

type PersistedSettings = Pick<SettingsState, 'symbol' | 'interval'>

/** Descarta valores inválidos vindos do localStorage. */
export function sanitizeSettings(raw: unknown): Partial<PersistedSettings> {
  if (typeof raw !== 'object' || raw === null) return {}
  const { symbol, interval } = raw as Record<string, unknown>
  const result: Partial<PersistedSettings> = {}
  if (typeof symbol === 'string' && isValidSymbol(symbol)) result.symbol = symbol
  if (isIntervalId(interval)) result.interval = interval
  return result
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      symbol: DEFAULT_SYMBOL,
      interval: DEFAULT_INTERVAL,
      setSymbol: (symbol) => set({ symbol }),
      setInterval: (interval) => set({ interval }),
    }),
    {
      name: 'pavio:settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ symbol, interval }) => ({ symbol, interval }),
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
    },
  ),
)
