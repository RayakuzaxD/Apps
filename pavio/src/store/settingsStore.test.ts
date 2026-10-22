import { describe, expect, it } from 'vitest'
import { defaultLogScale, sanitizeSettings, useSettingsStore } from './settingsStore'

describe('sanitizeSettings', () => {
  it('mantém valores válidos', () => {
    expect(sanitizeSettings({ symbol: 'ETHUSDT', interval: '4h' })).toEqual({
      symbol: 'ETHUSDT',
      interval: '4h',
    })
  })

  it('aceita o tema e descarta tema inválido', () => {
    expect(sanitizeSettings({ theme: 'dark' })).toEqual({ theme: 'dark' })
    expect(sanitizeSettings({ theme: 'sepia' })).toEqual({})
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
    expect(saved.state).toEqual({
      symbol: 'SOLUSDT',
      interval: '5m',
      theme: 'system',
      logScale: {},
    })
  })

  it('guarda a escala log por par', () => {
    useSettingsStore.getState().setLogScale('BTCUSDT', false)
    useSettingsStore.getState().setLogScale('ETHUSDT', true)
    expect(useSettingsStore.getState().logScale).toEqual({ BTCUSDT: false, ETHUSDT: true })
  })
})

describe('escala log', () => {
  it('ligada por padrão só nos pares de BTC', () => {
    expect(defaultLogScale('BTCUSDT')).toBe(true)
    expect(defaultLogScale('ETHBTC')).toBe(false)
    expect(defaultLogScale('SOLUSDT')).toBe(false)
  })

  it('descarta escolhas inválidas vindas do localStorage', () => {
    expect(sanitizeSettings({ logScale: { BTCUSDT: false, eth: true, SOLUSDT: 'sim' } })).toEqual({
      logScale: { BTCUSDT: false },
    })
    expect(sanitizeSettings({ logScale: 'sim' })).toEqual({})
  })
})
