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

/** Escala logarítmica ligada por padrão nos pares de BTC (ciclos de várias ordens de grandeza). */
export function defaultLogScale(symbol: string): boolean {
  return symbol.startsWith('BTC')
}

export interface SettingsState {
  symbol: string
  interval: IntervalId
  theme: ThemeSetting
  /** Escolha de escala log por par; sem escolha, vale `defaultLogScale`. */
  logScale: Record<string, boolean>
  setSymbol: (symbol: string) => void
  setInterval: (interval: IntervalId) => void
  setTheme: (theme: ThemeSetting) => void
  setLogScale: (symbol: string, on: boolean) => void
}

type PersistedSettings = Pick<SettingsState, 'symbol' | 'interval' | 'theme' | 'logScale'>

/** Descarta valores inválidos vindos do localStorage. */
export function sanitizeSettings(raw: unknown): Partial<PersistedSettings> {
  if (typeof raw !== 'object' || raw === null) return {}
  const { symbol, interval, theme, logScale } = raw as Record<string, unknown>
  const result: Partial<PersistedSettings> = {}
  if (typeof symbol === 'string' && isValidSymbol(symbol)) result.symbol = symbol
  if (isIntervalId(interval)) result.interval = interval
  if (isThemeSetting(theme)) result.theme = theme
  if (typeof logScale === 'object' && logScale !== null) {
    result.logScale = Object.fromEntries(
      Object.entries(logScale).filter(([s, on]) => isValidSymbol(s) && typeof on === 'boolean'),
    ) as Record<string, boolean>
  }
  return result
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      symbol: DEFAULT_SYMBOL,
      interval: DEFAULT_INTERVAL,
      theme: 'system',
      logScale: {},
      setSymbol: (symbol) => set({ symbol }),
      setInterval: (interval) => set({ interval }),
      setTheme: (theme) => set({ theme }),
      setLogScale: (symbol, on) => set((s) => ({ logScale: { ...s.logScale, [symbol]: on } })),
    }),
    {
      name: 'pavio:settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ symbol, interval, theme, logScale }) => ({
        symbol,
        interval,
        theme,
        logScale,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
    },
  ),
)
