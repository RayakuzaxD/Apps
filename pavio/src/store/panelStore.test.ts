import { describe, expect, it, vi } from 'vitest'
import { defaultPanelOpen, isPanelTab, usePanelStore } from './panelStore'

describe('panelStore', () => {
  it('troca de aba abre o painel e persiste', () => {
    usePanelStore.getState().setOpen(false)
    usePanelStore.getState().setTab('watchlist')
    expect(usePanelStore.getState()).toMatchObject({ open: true, tab: 'watchlist' })
    const saved = JSON.parse(localStorage.getItem('pavio:panel') ?? '{}')
    expect(saved.state).toEqual({ open: true, tab: 'watchlist' })
  })

  it('valida a aba', () => {
    expect(isPanelTab('reading')).toBe(true)
    expect(isPanelTab('alertas')).toBe(false)
  })

  it('começa fechado em tela estreita (o jsdom não tem matchMedia: aberto)', () => {
    expect(defaultPanelOpen()).toBe(true)
    let narrow = true
    vi.stubGlobal('matchMedia', () => ({ matches: narrow }))
    expect(defaultPanelOpen()).toBe(false)
    narrow = false
    expect(defaultPanelOpen()).toBe(true)
    vi.unstubAllGlobals()
  })
})
