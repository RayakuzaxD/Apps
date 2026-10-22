import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../store/settingsStore'
import { applyThemeAttribute, bindThemeToDocument, resolveTheme, useResolvedTheme } from './theme'

/** matchMedia controlável (o jsdom não implementa). */
function mockMatchMedia(initialDark: boolean) {
  let dark = initialDark
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return dark
    },
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }))
  return {
    setDark(value: boolean) {
      dark = value
      for (const l of listeners) l()
    },
  }
}

describe('tema', () => {
  beforeEach(() => useSettingsStore.setState({ theme: 'system' }))
  afterEach(() => {
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.theme
  })

  it('applyThemeAttribute define ou remove data-theme', () => {
    const root = document.createElement('html')
    applyThemeAttribute('dark', root)
    expect(root.dataset.theme).toBe('dark')
    applyThemeAttribute('light', root)
    expect(root.dataset.theme).toBe('light')
    applyThemeAttribute('system', root)
    expect(root.dataset.theme).toBeUndefined()
  })

  it('resolveTheme', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('bindThemeToDocument aplica na hora em que a preferência muda', () => {
    useSettingsStore.setState({ theme: 'dark' })
    const unbind = bindThemeToDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')
    useSettingsStore.getState().setTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    useSettingsStore.getState().setTheme('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    unbind()
    useSettingsStore.getState().setTheme('dark')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('useResolvedTheme segue o sistema no modo automático', () => {
    const media = mockMatchMedia(false)
    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('light')
    act(() => media.setDark(true))
    expect(result.current).toBe('dark')
    act(() => useSettingsStore.getState().setTheme('light'))
    expect(result.current).toBe('light')
    act(() => media.setDark(false))
    expect(result.current).toBe('light')
  })
})
