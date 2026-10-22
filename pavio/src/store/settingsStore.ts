import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_INTERVAL, isIntervalId } from '../domain/intervals'
import { DEFAULT_SYMBOL, isValidSymbol } from '../domain/symbols'
import type { IntervalId } from '../domain/types'

/** Preferência de tema: `system` segue o sistema operacional. */
export type ThemeSetting = 'system' | 'light' | 'dark'

export function isThemeSetting(value: unknown): value is ThemeSetting {
  return value === 'system' || value === 'light' || value === 'dark'
}

export interface SettingsState {
  symbol: string
  interval: IntervalId
  theme: ThemeSetting
  setSymbol: (symbol: string) => void
  setInterval: (interval: IntervalId) => void
  setTheme: (theme: ThemeSetting) => void
}

type PersistedSettings = Pick<SettingsState, 'symbol' | 'interval' | 'theme'>

/** Descarta valores inválidos vindos do localStorage. */
export function sanitizeSettings(raw: unknown): Partial<PersistedSettings> {
  if (typeof raw !== 'object' || raw === null) return {}
  const { symbol, interval, theme } = raw as Record<string, unknown>
  const result: Partial<PersistedSettings> = {}
  if (typeof symbol === 'string' && isValidSymbol(symbol)) result.symbol = symbol
  if (isIntervalId(interval)) result.interval = interval
  if (isThemeSetting(theme)) result.theme = theme
  return result
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      symbol: DEFAULT_SYMBOL,
      interval: DEFAULT_INTERVAL,
      theme: 'system',
      setSymbol: (symbol) => set({ symbol }),
      setInterval: (interval) => set({ interval }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'pavio:settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ symbol, interval, theme }) => ({ symbol, interval, theme }),
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
    },
  ),
)
