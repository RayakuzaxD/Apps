import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeCandle } from '../domain/candles'
import {
  computeIndicator,
  defaultParams,
  type IndicatorConfig,
} from '../domain/indicators/registry'
import type { Candle } from '../domain/types'
import { ChartController, OLDER_THRESHOLD_BARS } from './ChartController'
import type { ChartTheme } from './theme'
import { CANDLE_SCALE_MARGINS, VOLUME_SCALE_MARGINS } from './volume'

interface FakePane {
  index: number
  setStretchFactor: ReturnType<typeof vi.fn>
}

interface FakeSeries {
  kind: string
  options: Record<string, unknown>
  pane: FakePane
  removed: boolean
  setData: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  applyOptions: ReturnType<typeof vi.fn>
  createPriceLine: ReturnType<typeof vi.fn>
  removePriceLine: ReturnType<typeof vi.fn>
  scale: { applyOptions: ReturnType<typeof vi.fn> }
  priceScale: () => { applyOptions: ReturnType<typeof vi.fn> }
  getPane: () => { paneIndex: () => number; getHTMLElement: () => HTMLElement | null }
}

type RangeHandler = (range: { from: number; to: number } | null) => void

const fake = vi.hoisted(() => ({
  series: [] as FakeSeries[],
  panes: [] as FakePane[],
  visibleRange: null as { from: number; to: number } | null,
  rangeHandlers: new Set<RangeHandler>(),
  crosshairHandlers: new Set<(param: unknown) => void>(),
  chartScales: {} as Record<string, { applyOptions: ReturnType<typeof vi.fn> }>,
}))

vi.mock('lightweight-charts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lightweight-charts')>()

  // Painéis vazios somem e os seguintes sobem, como na biblioteca.
  const prunePanes = () => {
    fake.panes = fake.panes.filter((p) => fake.series.some((s) => !s.removed && s.pane === p))
    fake.panes.forEach((p, i) => (p.index = i))
  }

  const createSeries = (
    kind: string,
    options: Record<string, unknown>,
    paneIndex: number,
  ): FakeSeries => {
    let pane = fake.panes[paneIndex]
    if (!pane) {
      pane = { index: fake.panes.length, setStretchFactor: vi.fn() }
      fake.panes.push(pane)
    }
    const scale = { applyOptions: vi.fn() }
    const series: FakeSeries = {
      kind,
      options,
      pane,
      removed: false,
      setData: vi.fn(),
      update: vi.fn(),
      applyOptions: vi.fn(),
      createPriceLine: vi.fn((opts: unknown) => opts),
      removePriceLine: vi.fn(),
      scale,
      priceScale: () => scale,
      getPane: () => ({
        paneIndex: () => series.pane.index,
        getHTMLElement: () => document.body,
      }),
    }
    return series
  }

  return {
    ...actual,
    createChart: () => ({
      addSeries: (
        definition: { type: string },
        options: Record<string, unknown>,
        paneIndex = 0,
      ) => {
        const s = createSeries(definition.type, options, paneIndex)
        fake.series.push(s)
        return s
      },
      removeSeries: (s: FakeSeries) => {
        s.removed = true
        prunePanes()
      },
      panes: () => fake.panes,
      applyOptions: vi.fn(),
      priceScale: (id: string) => (fake.chartScales[id] ??= { applyOptions: vi.fn() }),
      timeScale: () => ({
        resetTimeScale: vi.fn(),
        getVisibleLogicalRange: () => fake.visibleRange,
        subscribeVisibleLogicalRangeChange: (h: RangeHandler) => fake.rangeHandlers.add(h),
        unsubscribeVisibleLogicalRangeChange: (h: RangeHandler) => fake.rangeHandlers.delete(h),
      }),
      subscribeCrosshairMove: (h: (param: unknown) => void) => fake.crosshairHandlers.add(h),
      unsubscribeCrosshairMove: (h: (param: unknown) => void) => fake.crosshairHandlers.delete(h),
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
    fake.panes = []
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
    ctl.setData('BTCUSDT:1d', '1d', [c(86_400, 10, 12, 100), c(172_800, 12, 11, 250)])

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
    ctl.setData('BTCUSDT:1d', '1d', [first, last])
    const volume = byKind('Histogram')
    volume.setData.mockClear()

    ctl.setData('BTCUSDT:1d', '1d', [first, c(172_800, 12, 13, 300)])
    expect(volume.setData).not.toHaveBeenCalled()
    expect(volume.update).toHaveBeenLastCalledWith({
      time: 172_800,
      value: 300,
      color: '#00ff0073',
    })
  })

  it('recolore o volume ao trocar o tema', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    ctl.setData('BTCUSDT:1d', '1d', [c(86_400, 10, 12, 100)])
    ctl.applyTheme({ ...theme, up: '#0000ff' })
    expect(byKind('Histogram').setData).toHaveBeenLastCalledWith([
      { time: 86_400, value: 100, color: '#0000ff73' },
    ])
  })
})

describe('ChartController: indicadores', () => {
  beforeEach(() => {
    fake.series = []
    fake.panes = []
  })

  const candles = Array.from({ length: 40 }, (_, i) => c(86_400 * (i + 1), 10 + i, 11 + i, 5))
  const cfg = (id: string, type: IndicatorConfig['type'], params = {}): IndicatorConfig => ({
    id,
    type,
    params: { ...defaultParams(type), ...params },
    visible: true,
  })
  const results = (configs: IndicatorConfig[], data = candles) =>
    configs.map((config) => computeIndicator(config, data))
  const seriesOf = (count: number) => fake.series.slice(-count)

  it('overlays ficam no painel principal; IFR e MACD ganham painéis próprios', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    ctl.setData(
      'X:1d',
      '1d',
      candles,
      results([cfg('e', 'ema'), cfg('r', 'rsi'), cfg('m', 'macd')]),
    )

    const live = fake.series.filter((s) => !s.removed)
    // candles + volume + MME + IFR + (histograma, MACD, sinal)
    expect(live.map((s) => [s.kind, s.pane.index])).toEqual([
      ['Candlestick', 0],
      ['Histogram', 0],
      ['Line', 0],
      ['Line', 1],
      ['Histogram', 2],
      ['Line', 2],
      ['Line', 2],
    ])
    expect(fake.panes[0]!.setStretchFactor).toHaveBeenCalledWith(3)
    expect(fake.panes[1]!.setStretchFactor).toHaveBeenCalledWith(1)
  })

  it('MME recebe espaços em branco no início e valores alinhados aos candles', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    ctl.setData('X:1d', '1d', candles, results([cfg('e', 'ema', { period: 3, color: '#123456' })]))
    const [ema] = seriesOf(1)
    const points = ema!.setData.mock.calls[0]![0] as { time: number; value?: number }[]
    expect(points).toHaveLength(40)
    expect(points[0]).toEqual({ time: 86_400 })
    expect(points[2]).toEqual({ time: 86_400 * 3, value: 12 })
    expect(ema!.applyOptions).toHaveBeenCalledWith({ visible: true, color: '#123456' })
  })

  it('IFR tem escala fixa 0–100 e linhas de sobrecompra/sobrevenda', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    ctl.setData('X:1d', '1d', candles, results([cfg('r', 'rsi')]))
    const [rsiSeries] = seriesOf(1)
    const provider = rsiSeries!.options.autoscaleInfoProvider as () => unknown
    expect(provider()).toEqual({ priceRange: { minValue: 0, maxValue: 100 } })
    expect(
      rsiSeries!.createPriceLine.mock.calls.map((call) => (call[0] as { price: number }).price),
    ).toEqual([70, 30])
  })

  it('em tempo real atualiza só os pontos finais dos indicadores', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const config = cfg('e', 'ema', { period: 3 })
    ctl.setData('X:1d', '1d', candles, results([config]))
    const [ema] = seriesOf(1)
    ema!.setData.mockClear()

    const next = mergeCandle(candles, c(86_400 * 41, 50, 52, 5))
    ctl.setData('X:1d', '1d', next, [computeIndicator(config, next)])
    expect(ema!.setData).not.toHaveBeenCalled()
    expect(ema!.update).toHaveBeenCalledTimes(1)
    expect(ema!.update.mock.calls[0]![0]).toMatchObject({ time: 86_400 * 41 })
  })

  it('editar parâmetros reenvia os dados; remover apaga as séries e o painel', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const rsiCfg = cfg('r', 'rsi')
    ctl.setData('X:1d', '1d', candles, results([rsiCfg]))
    const [rsiSeries] = seriesOf(1)
    rsiSeries!.setData.mockClear()

    const edited = { ...rsiCfg, params: { ...rsiCfg.params, period: 5 } }
    ctl.setData('X:1d', '1d', candles, results([edited]))
    expect(rsiSeries!.setData).toHaveBeenCalledTimes(1)

    ctl.setData('X:1d', '1d', candles, [])
    expect(rsiSeries!.removed).toBe(true)
    expect(fake.panes).toHaveLength(1)
  })

  it('ocultar aplica visible=false e remove as linhas de nível do IFR', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const rsiCfg = cfg('r', 'rsi')
    ctl.setData('X:1d', '1d', candles, results([rsiCfg]))
    const [rsiSeries] = seriesOf(1)
    ctl.setData('X:1d', '1d', candles, results([{ ...rsiCfg, visible: false }]))
    expect(rsiSeries!.applyOptions).toHaveBeenLastCalledWith({ visible: false, color: '#a855f7' })
    expect(rsiSeries!.removePriceLine).toHaveBeenCalledTimes(2)
  })
})

describe('ChartController: troca de tema', () => {
  beforeEach(() => {
    fake.series = []
    fake.panes = []
  })

  it('recolore o histograma do MACD e as linhas de nível do IFR', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const candles = Array.from({ length: 60 }, (_, i) =>
      c(86_400 * (i + 1), 10 + Math.sin(i), 10 + Math.cos(i), 5),
    )
    const results = (['macd', 'rsi'] as const).map((type) =>
      computeIndicator({ id: type, type, params: defaultParams(type), visible: true }, candles),
    )
    ctl.setData('X:1d', '1d', candles, results)
    const histogram = fake.series.find((s) => s.kind === 'Histogram' && s.pane.index === 1)!
    const rsiLine = fake.series.find((s) => s.pane.index === 2)!

    ctl.applyTheme({ ...theme, up: '#0000ff', down: '#00ffff', text: '#123123' })
    const points = histogram.setData.mock.lastCall![0] as { value?: number; color?: string }[]
    const colored = points.filter((p) => p.value !== undefined)
    expect(colored.length).toBeGreaterThan(0)
    for (const p of colored) {
      expect(p.color).toBe(p.value! >= 0 ? '#0000ff99' : '#00ffff99')
    }
    const lastLevels = rsiLine.createPriceLine.mock.calls.slice(-2)
    expect(lastLevels.map((call) => (call[0] as { color: string }).color)).toEqual([
      '#123123',
      '#123123',
    ])
  })
})

describe('ChartController: histórico anterior e crosshair', () => {
  const series = (count: number, start = 0) =>
    Array.from({ length: count }, (_, i) => c((start + i) * 3600, 10, 11, 1))

  const scroll = (from: number) => {
    fake.visibleRange = { from, to: from + 100 }
    for (const h of fake.rangeHandlers) h(fake.visibleRange)
  }

  beforeEach(() => {
    fake.series = []
    fake.panes = []
    fake.visibleRange = null
    fake.rangeHandlers.clear()
    fake.crosshairHandlers.clear()
  })

  it('avisa quando a área visível chega perto do primeiro candle', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const listener = vi.fn()
    ctl.onNeedOlder(listener)
    ctl.setData('BTCUSDT:1h', '1h', series(1000))

    scroll(800)
    expect(listener).not.toHaveBeenCalled()
    scroll(OLDER_THRESHOLD_BARS + 1)
    expect(listener).not.toHaveBeenCalled()
    scroll(OLDER_THRESHOLD_BARS)
    expect(listener).toHaveBeenCalledTimes(1)
    scroll(-20)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('não avisa sem dados', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const listener = vi.fn()
    ctl.onNeedOlder(listener)
    scroll(0)
    expect(listener).not.toHaveBeenCalled()
  })

  it('confere a borda de novo quando o histórico anterior chega', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const listener = vi.fn()
    ctl.onNeedOlder(listener)
    const recent = series(1000, 1000)
    ctl.setData('BTCUSDT:1h', '1h', recent)

    // Zoom aberto: mesmo com o histórico novo, a borda segue visível.
    fake.visibleRange = { from: -500, to: 2000 }
    ctl.setData('BTCUSDT:1h', '1h', [...series(1000), ...recent])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('informa quando o primeiro candle entra e sai da tela', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const listener = vi.fn()
    ctl.onLeftEdgeVisible(listener)
    ctl.setData('BTCUSDT:1h', '1h', series(1000))

    scroll(500)
    expect(listener).not.toHaveBeenCalled()
    scroll(0)
    expect(listener).toHaveBeenLastCalledWith(true)
    scroll(-30)
    expect(listener).toHaveBeenCalledTimes(1)
    scroll(10)
    expect(listener).toHaveBeenLastCalledWith(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('para de avisar depois de destroy', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const listener = vi.fn()
    ctl.onNeedOlder(listener)
    ctl.setData('BTCUSDT:1h', '1h', series(10))
    ctl.destroy()
    expect(fake.rangeHandlers.size).toBe(0)
  })

  it('informa o horário real do candle sob o crosshair', () => {
    const ctl = new ChartController(document.createElement('div'), theme)
    const listener = vi.fn()
    ctl.onCrosshair(listener)
    ctl.setData('BTCUSDT:1d', '1d', series(3))
    const move = (param: unknown) => {
      for (const h of fake.crosshairHandlers) h(param)
    }

    move({ time: 7200, logical: 2 })
    expect(listener).toHaveBeenLastCalledWith(7200)
    move({ time: undefined, logical: undefined })
    expect(listener).toHaveBeenLastCalledWith(null)
    move({ time: 0, logical: 5 })
    expect(listener).toHaveBeenLastCalledWith(null)
  })
})

describe('ChartController: escala log', () => {
  it('alterna a escala de preço entre logarítmica e normal', async () => {
    const { PriceScaleMode } = await import('lightweight-charts')
    fake.chartScales = {}
    const ctl = new ChartController(document.createElement('div'), theme)
    ctl.setLogScale(true)
    expect(fake.chartScales.right!.applyOptions).toHaveBeenLastCalledWith({
      mode: PriceScaleMode.Logarithmic,
    })
    ctl.setLogScale(false)
    expect(fake.chartScales.right!.applyOptions).toHaveBeenLastCalledWith({
      mode: PriceScaleMode.Normal,
    })
  })
  it('painéis de indicador continuam em escala linear com o preço em log', async () => {
    const { PriceScaleMode } = await import('lightweight-charts')
    fake.series = []
    fake.panes = []
    fake.chartScales = {}
    const ctl = new ChartController(document.createElement('div'), theme)
    const candles = Array.from({ length: 30 }, (_, i) => c(i * 86_400, 10, 11 + (i % 3), 1))
    const rsi = { id: 'r', type: 'rsi' as const, params: defaultParams('rsi'), visible: true }
    ctl.setData('X:1d', '1d', candles, [computeIndicator(rsi, candles)])
    const rsiSeries = fake.series.find((x) => x.pane.index === 1)!
    rsiSeries.scale.applyOptions.mockClear()

    ctl.setLogScale(true)
    expect(rsiSeries.scale.applyOptions).toHaveBeenCalledWith({ mode: PriceScaleMode.Normal })
  })
})
