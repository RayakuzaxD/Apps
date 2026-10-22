import { useSyncExternalStore } from 'react'
import { useSettingsStore, type ThemeSetting } from '../store/settingsStore'

export type ResolvedTheme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Aplica a preferência no `<html>`. Os tokens CSS (styles/tokens.css) leem
 * `data-theme`; sem o atributo, seguem `prefers-color-scheme`.
 */
export function applyThemeAttribute(setting: ThemeSetting, root = document.documentElement) {
  if (setting === 'system') delete root.dataset.theme
  else root.dataset.theme = setting
}

export function resolveTheme(setting: ThemeSetting, systemPrefersDark: boolean): ResolvedTheme {
  if (setting === 'system') return systemPrefersDark ? 'dark' : 'light'
  return setting
}

/**
 * Mantém o `<html>` em sincronia com a store. Roda fora do React e de forma
 * síncrona a cada mudança, para que quem ler as variáveis CSS logo depois
 * (o gráfico) já veja as cores novas.
 */
export function bindThemeToDocument(): () => void {
  applyThemeAttribute(useSettingsStore.getState().theme)
  return useSettingsStore.subscribe((state, prev) => {
    if (state.theme !== prev.theme) applyThemeAttribute(state.theme)
  })
}

function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function systemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches
}

/** Tema efetivo (claro/escuro), considerando a preferência e o sistema. */
export function useResolvedTheme(): ResolvedTheme {
  const setting = useSettingsStore((s) => s.theme)
  const prefersDark = useSyncExternalStore(subscribeSystem, systemPrefersDark)
  return resolveTheme(setting, prefersDark)
}
