import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { pricePrecision } from '../domain/candles'
import { formatPrice, formatVolume } from '../domain/format'
import type { IndicatorResult } from '../domain/indicators/registry'
import { getInterval, isIntraday, timeDetail, type TimeDetail } from '../domain/intervals'
import type { Candle, IntervalId } from '../domain/types'
import { DrawingController, type DrawingCallbacks } from '../drawings/DrawingController'
import { IndicatorView } from './IndicatorView'
import type { ChartTheme } from './theme'
import { formatCrosshairTime, formatTickMark, localOffsetSeconds } from './time'
import { planCandleUpdate } from './updatePlan'
import {
  CANDLE_SCALE_MARGINS,
  VOLUME_SCALE_MARGINS,
  volumeColor,
  volumeColors,
  type VolumeColors,
} from './volume'

const VOLUME_SCALE_ID = 'volume'

/** Candles restantes à esquerda da área visível abaixo dos quais pedimos histórico anterior. */
export const OLDER_THRESHOLD_BARS = 50

/** Horário (segundos UTC) do candle sob o crosshair, ou null quando o mouse sai do gráfico. */
export type CrosshairListener = (time: number | null) => void

/** Chamado quando a área visível se aproxima do primeiro candle carregado. */
export type NeedOlderListener = () => void

/** Chamado quando o primeiro candle carregado entra ou sai da área visível. */
export type LeftEdgeListener = (visible: boolean) => void

/**
 * Adaptador imperativo do Lightweight Charts. O React só chama métodos daqui;
 * o gráfico é criado uma vez por container e nunca recriado a cada render.
 */
export class ChartController {
  private readonly chart: IChartApi
  private readonly candleSeries: ISeriesApi<'Candlestick'>
  private readonly volumeSeries: ISeriesApi<'Histogram'>
  private volumeColors: VolumeColors = { up: '', down: '' }
  private dataKey: string | null = null
  private candles: readonly Candle[] = []
  private timeOffset = 0
  private intraday = true
  private detail: TimeDetail = 'intraday'
  private intervalSeconds = 3600
  private times: number[] = []
  private timesFor: readonly Candle[] | null = null
  private precision = 2
  private needsViewReset = true
  private readonly crosshairListeners = new Set<CrosshairListener>()
  private readonly needOlderListeners = new Set<NeedOlderListener>()
  private readonly leftEdgeListeners = new Set<LeftEdgeListener>()
  private leftEdgeVisible = false
  private readonly indicatorViews = new Map<string, IndicatorView>()
  private theme: ChartTheme

  constructor(container: HTMLElement, theme: ChartTheme) {
    this.theme = theme
    this.chart = createChart(container, {
      autoSize: true,
      layout: {
        attributionLogo: false, // atribuição exibida no rodapé do app (ver NOTICE)
        fontSize: 12,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { style: LineStyle.Dashed, labelBackgroundColor: theme.text },
        horzLine: { style: LineStyle.Dashed, labelBackgroundColor: theme.text },
      },
      timeScale: {
        rightOffset: 8,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, type: Parameters<typeof formatTickMark>[1]) =>
          formatTickMark(time as number, type),
      },
      localization: {
        locale: 'pt-BR',
        timeFormatter: (time: Time) => formatCrosshairTime(time as number, this.detail),
        priceFormatter: (price: number) => formatPrice(price, this.precision),
      },
    })

    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      priceLineStyle: LineStyle.Dotted,
    })
    this.candleSeries.priceScale().applyOptions({ scaleMargins: CANDLE_SCALE_MARGINS })

    // Volume sobreposto na faixa inferior do painel principal, em escala própria e oculta.
    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      priceScaleId: VOLUME_SCALE_ID,
      priceFormat: { type: 'custom', formatter: formatVolume, minMove: 1e-8 },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    this.volumeSeries.priceScale().applyOptions({ scaleMargins: VOLUME_SCALE_MARGINS })

    this.chart.subscribeCrosshairMove(this.handleCrosshair)
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.handleVisibleRange)
    this.applyTheme(theme)
  }

  applyTheme(theme: ChartTheme) {
    this.theme = theme
    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.text,
        fontFamily: theme.fontFamily,
        panes: { separatorColor: theme.border, separatorHoverColor: theme.grid },
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      rightPriceScale: { borderColor: theme.border },
      timeScale: { borderColor: theme.border },
      crosshair: {
        vertLine: { color: theme.crosshair, labelBackgroundColor: theme.text },
        horzLine: { color: theme.crosshair, labelBackgroundColor: theme.text },
      },
    })
    this.candleSeries.applyOptions({
      upColor: theme.up,
      downColor: theme.down,
      borderUpColor: theme.up,
      borderDownColor: theme.down,
      wickUpColor: theme.up,
      wickDownColor: theme.down,
    })
    // As cores do volume são por barra: é preciso reenviar os dados.
    this.volumeColors = volumeColors(theme)
    this.volumeSeries.setData(this.candles.map((c) => this.toVolumeBar(c)))
    for (const view of this.indicatorViews.values()) view.applyTheme(theme)
  }

  /**
   * Envia candles e indicadores ao gráfico. `key` identifica a série
   * (ex.: "BTCUSDT:1h"); trocar a chave reinicia a visão.
   */
  setData(
    key: string,
    interval: IntervalId,
    candles: readonly Candle[],
    indicators: readonly IndicatorResult[] = [],
  ) {
    const plan = planCandleUpdate(this.dataKey, this.candles, key, candles)
    this.dataKey = key
    this.candles = candles

    switch (plan.kind) {
      case 'none':
        break
      case 'update':
        for (const c of plan.candles) {
          this.candleSeries.update(this.toBar(c))
          this.volumeSeries.update(this.toVolumeBar(c))
        }
        this.updatePrecision()
        break
      case 'reset':
      case 'replace':
        if (plan.kind === 'reset') {
          this.configureInterval(interval)
          this.needsViewReset = true
        }
        this.candleSeries.setData(candles.map((c) => this.toBar(c)))
        this.volumeSeries.setData(candles.map((c) => this.toVolumeBar(c)))
        this.updatePrecision()
        break
    }

    const fromIndex = plan.kind === 'update' ? candles.length - plan.candles.length : 0
    this.syncIndicators(indicators, plan.kind === 'update' ? fromIndex : plan.kind)

    if (this.needsViewReset && candles.length > 0) {
      this.needsViewReset = false
      this.chart.timeScale().resetTimeScale()
      this.chart.priceScale('right').applyOptions({ autoScale: true })
      this.chart.priceScale(VOLUME_SCALE_ID).applyOptions({ autoScale: true })
    }

    // Com zoom bem aberto, o histórico recém-chegado pode ainda não preencher a
    // tela, e a área visível não muda: confere a borda de novo.
    if (plan.kind === 'replace') this.checkLeftEdge(this.chart.timeScale().getVisibleLogicalRange())
  }

  /** Escala de preço logarítmica (indicadores sobrepostos acompanham, pois usam a mesma escala). */
  setLogScale(on: boolean) {
    this.chart.priceScale('right', 0).applyOptions({
      mode: on ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    })
    for (const view of this.indicatorViews.values()) view.keepLinearScale()
  }

  /** Liga as ferramentas de desenho à série de candles deste gráfico. */
  createDrawingController(container: HTMLElement, callbacks: DrawingCallbacks): DrawingController {
    return new DrawingController(
      {
        chart: this.chart,
        series: this.candleSeries,
        container,
        getTimes: () => this.getTimes(),
        getIntervalSeconds: () => this.intervalSeconds,
        formatPrice: (p) => formatPrice(p, this.precision),
        getBackground: () => this.theme.background,
      },
      callbacks,
    )
  }

  /** Elemento do painel onde o indicador é desenhado (para posicionar sua legenda). */
  getIndicatorPaneElement(id: string): HTMLElement | null {
    return this.indicatorViews.get(id)?.getPaneElement() ?? null
  }

  onCrosshair(listener: CrosshairListener): () => void {
    this.crosshairListeners.add(listener)
    return () => this.crosshairListeners.delete(listener)
  }

  /** Avisa quando o usuário rola até perto do início dos dados carregados. */
  onNeedOlder(listener: NeedOlderListener): () => void {
    this.needOlderListeners.add(listener)
    return () => this.needOlderListeners.delete(listener)
  }

  onLeftEdgeVisible(listener: LeftEdgeListener): () => void {
    this.leftEdgeListeners.add(listener)
    return () => this.leftEdgeListeners.delete(listener)
  }

  destroy() {
    this.chart.unsubscribeCrosshairMove(this.handleCrosshair)
    this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.handleVisibleRange)
    this.crosshairListeners.clear()
    this.needOlderListeners.clear()
    this.leftEdgeListeners.clear()
    for (const view of this.indicatorViews.values()) view.destroy()
    this.indicatorViews.clear()
    this.chart.remove()
  }

  /**
   * Cria, atualiza e remove as séries de indicadores. `change` é o índice a
   * partir do qual os candles mudaram (tempo real) ou o tipo de troca completa.
   */
  private syncIndicators(
    results: readonly IndicatorResult[],
    change: number | 'none' | 'reset' | 'replace',
  ) {
    const ids = new Set(results.map((r) => r.config.id))
    for (const [id, view] of this.indicatorViews) {
      if (!ids.has(id)) {
        view.destroy()
        this.indicatorViews.delete(id)
      }
    }

    const timeAt = (i: number) => this.candles[i]!.time + this.timeOffset
    const length = this.candles.length
    for (const { config, outputs } of results) {
      let view = this.indicatorViews.get(config.id)
      if (!view) {
        view = new IndicatorView(config, {
          chart: this.chart,
          theme: this.theme,
          formatPrice: (v) => formatPrice(v, this.precision),
        })
        this.indicatorViews.set(config.id, view)
        view.setData(timeAt, outputs, length)
      } else if (view.getConfig() !== config) {
        view.setConfig(config)
        view.setData(timeAt, outputs, length)
      } else if (typeof change === 'number') {
        view.updateFrom(timeAt, outputs, length, change)
      } else if (change !== 'none') {
        view.setData(timeAt, outputs, length)
      }
    }
  }

  private configureInterval(interval: IntervalId) {
    this.intraday = isIntraday(interval)
    this.detail = timeDetail(interval)
    this.intervalSeconds = getInterval(interval).seconds
    this.timeOffset = this.intraday ? localOffsetSeconds() : 0
    this.chart.applyOptions({ timeScale: { timeVisible: this.intraday } })
  }

  /** Tempos reais dos candles (cache refeito quando a série muda). */
  private getTimes(): readonly number[] {
    if (this.timesFor !== this.candles) {
      this.times = this.candles.map((c) => c.time)
      this.timesFor = this.candles
    }
    return this.times
  }

  private updatePrecision() {
    const last = this.candles[this.candles.length - 1]
    if (!last) return
    const precision = pricePrecision(last.close)
    if (precision === this.precision) return
    this.precision = precision
    this.candleSeries.applyOptions({
      priceFormat: { type: 'price', precision, minMove: 10 ** -precision },
    })
  }

  private toBar(c: Candle): CandlestickData<Time> {
    return {
      time: (c.time + this.timeOffset) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }
  }

  private toVolumeBar(c: Candle): HistogramData<Time> {
    return {
      time: (c.time + this.timeOffset) as UTCTimestamp,
      value: c.volume,
      color: volumeColor(c, this.volumeColors),
    }
  }

  private checkLeftEdge(range: LogicalRange | null) {
    if (!range || this.candles.length === 0) return
    const visible = range.from <= 0
    if (visible !== this.leftEdgeVisible) {
      this.leftEdgeVisible = visible
      for (const l of this.leftEdgeListeners) l(visible)
    }
    if (range.from > OLDER_THRESHOLD_BARS) return
    for (const l of this.needOlderListeners) l()
  }

  private readonly handleVisibleRange = (range: LogicalRange | null) => this.checkLeftEdge(range)

  private readonly handleCrosshair = (param: MouseEventParams<Time>) => {
    const logical = param.logical
    let time: number | null = null
    if (param.time !== undefined && logical !== undefined) {
      const candle = this.candles[Math.round(logical)]
      if (candle) time = candle.time
    }
    for (const l of this.crosshairListeners) l(time)
  }
}
