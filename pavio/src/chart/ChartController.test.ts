import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Candle } from '../domain/types'
import { ChartController } from './ChartController'
import type { ChartTheme } from './theme'
import { CANDLE_SCALE_MARGINS, VOLUME_SCALE_MARGINS } from './volume'

interface FakeSeries {
  kind: string
  options: Record<string, unknown>
  setData: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  applyOptions: ReturnType<typeof vi.fn>
  scale: { applyOptions: ReturnType<typeof vi.fn> }
  priceScale: () => { applyOptions: ReturnType<typeof vi.fn> }
}

const fake = vi.hoisted(() => ({ series: [] as FakeSeries[] }))

vi.mock('lightweight-charts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lightweight-charts')>()
  const createSeries = (kind: string, options: Record<string, unknown>): FakeSeries => {
    const scale = { applyOptions: vi.fn() }
    return {
      kind,
      options,
      setData: vi.fn(),
      update: vi.fn(),
      applyOptions: vi.fn(),
      scale,
      priceScale: () => scale,
    }
  }
  return {
    ...actual,
    createChart: () => ({
      addSeries: (definition: { type: string }, options: Record<string, unknown>) => {
        const s = createSeries(definition.type, options)
        fake.series.push(s)
        return s
      },
      applyOptions: vi.fn(),
      priceScale: () => ({ applyOptions: vi.fn() }),
      timeScale: () => ({ resetTimeScale: vi.fn() }),
      subscribeCrosshairMove: vi.fn(),
      unsubscribeCrosshairMove: vi.fn(),
      remove: vi.fn(),
    }),
  }
})

const theme: ChartTheme = {
  background: '#ffffff',
  text: '#333333',
  grid: '#eeeeee',
  border: '#dddddd',
  crosshair: '#333333',
  up: '#00ff00',
  down: '#ff0000',
  fontFamily: 'sans-serif',
}

const c = (time: number, open: number, close: number, volume: number): Candle => ({
  time,
  open,
  high: Math.max(open, close),
  low: Math.min(open, close),
  close,
  volume,
})

const byKind = (kind: string) => {
  const s = fake.series.find((x) => x.kind === kind)
  if (!s) throw new Error(`série ${kind} não criada`)
  return s
}

describe('ChartController: volume', () => {
  beforeEach(() => {
    fake.series = []
  })

  it('cria o histograma de volume em escala sobreposta na faixa inferior', () => {
    new ChartController(document.createElement('div'), theme)
    const candles = byKind('Candlestick')
    const volume = byKind('Histogram')

    expect(volume.options).toMatchObject({
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    expect(volume.scale.applyOptions).toHaveBeenCalledWith({ scaleMargins: VOLUME_SCALE_MARGINS })
    expect(candles.scale.applyOptions).toHaveBeenCalledWith({ scaleMargins: CANDLE_SCALE_MARGINS })
  })

  it('envia volume com cor de alta/baixa junto com os candles (diário, sem deslocamento)', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    ctl.setCandles('BTCUSDT:1d', '1d', [c(86_400, 10, 12, 100), c(172_800, 12, 11, 250)])

    const volume = byKind('Histogram')
    expect(volume.setData).toHaveBeenLastCalledWith([
      { time: 86_400, value: 100, color: '#00ff0073' },
      { time: 172_800, value: 250, color: '#ff000073' },
    ])
  })

  it('atualiza a última barra de volume em tempo real sem reenviar a série', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const first = c(86_400, 10, 12, 100)
    const last = c(172_800, 12, 11, 250)
    ctl.setCandles('BTCUSDT:1d', '1d', [first, last])
    const volume = byKind('Histogram')
    volume.setData.mockClear()

    ctl.setCandles('BTCUSDT:1d', '1d', [first, c(172_800, 12, 13, 300)])
    expect(volume.setData).not.toHaveBeenCalled()
    expect(volume.update).toHaveBeenLastCalledWith({
      time: 172_800,
      value: 300,
      color: '#00ff0073',
    })
  })

  it('recolore o volume ao trocar o tema', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    ctl.setCandles('BTCUSDT:1d', '1d', [c(86_400, 10, 12, 100)])
    ctl.applyTheme({ ...theme, up: '#0000ff' })
    expect(byKind('Histogram').setData).toHaveBeenLastCalledWith([
      { time: 86_400, value: 100, color: '#0000ff73' },
    ])
  })
})
