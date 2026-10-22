import { describe, expect, it } from 'vitest'
import { sanitizeSettings, useSettingsStore } from './settingsStore'

describe('sanitizeSettings', () => {
  it('mantém valores válidos', () => {
    expect(sanitizeSettings({ symbol: 'ETHUSDT', interval: '4h' })).toEqual({
      symbol: 'ETHUSDT',
      interval: '4h',
    })
  })

  it('descarta valores inválidos', () => {
    expect(sanitizeSettings({ symbol: 'eth', interval: '3h' })).toEqual({})
    expect(sanitizeSettings('lixo')).toEqual({})
    expect(sanitizeSettings(null)).toEqual({})
  })
})

describe('useSettingsStore', () => {
  it('atualiza e persiste par e intervalo', () => {
    useSettingsStore.getState().setSymbol('SOLUSDT')
    useSettingsStore.getState().setInterval('5m')
    expect(useSettingsStore.getState()).toMatchObject({ symbol: 'SOLUSDT', interval: '5m' })
    const saved = JSON.parse(localStorage.getItem('pavio:settings') ?? '{}')
    expect(saved.state).toEqual({ symbol: 'SOLUSDT', interval: '5m' })
  })
})
