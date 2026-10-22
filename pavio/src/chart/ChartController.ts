import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { pricePrecision } from '../domain/candles'
import { formatPrice, formatVolume } from '../domain/format'
import { isIntraday } from '../domain/intervals'
import type { Candle, IntervalId } from '../domain/types'
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

export type CrosshairListener = (candle: Candle | null) => void

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
  private precision = 2
  private needsViewReset = true
  private readonly crosshairListeners = new Set<CrosshairListener>()

  constructor(container: HTMLElement, theme: ChartTheme) {
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
        timeFormatter: (time: Time) => formatCrosshairTime(time as number, this.intraday),
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
    this.applyTheme(theme)
  }

  applyTheme(theme: ChartTheme) {
    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.text,
        fontFamily: theme.fontFamily,
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
  }

  /** `key` identifica a série (ex.: "BTCUSDT:1h"); trocar a chave reinicia a visão. */
  setCandles(key: string, interval: IntervalId, candles: readonly Candle[]) {
    const plan = planCandleUpdate(this.dataKey, this.candles, key, candles)
    this.dataKey = key
    this.candles = candles

    switch (plan.kind) {
      case 'none':
        return
      case 'update':
        for (const c of plan.candles) {
          this.candleSeries.update(this.toBar(c))
          this.volumeSeries.update(this.toVolumeBar(c))
        }
        this.updatePrecision()
        return
      case 'reset':
        this.configureInterval(interval)
        this.needsViewReset = true
        break
      case 'replace':
        break
    }

    this.candleSeries.setData(candles.map((c) => this.toBar(c)))
    this.volumeSeries.setData(candles.map((c) => this.toVolumeBar(c)))
    this.updatePrecision()
    if (this.needsViewReset && candles.length > 0) {
      this.needsViewReset = false
      this.chart.timeScale().resetTimeScale()
      this.chart.priceScale('right').applyOptions({ autoScale: true })
      this.chart.priceScale(VOLUME_SCALE_ID).applyOptions({ autoScale: true })
    }
  }

  onCrosshairCandle(listener: CrosshairListener): () => void {
    this.crosshairListeners.add(listener)
    return () => this.crosshairListeners.delete(listener)
  }

  destroy() {
    this.chart.unsubscribeCrosshairMove(this.handleCrosshair)
    this.crosshairListeners.clear()
    this.chart.remove()
  }

  private configureInterval(interval: IntervalId) {
    this.intraday = isIntraday(interval)
    this.timeOffset = this.intraday ? localOffsetSeconds() : 0
    this.chart.applyOptions({ timeScale: { timeVisible: this.intraday } })
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

  private readonly handleCrosshair = (param: MouseEventParams<Time>) => {
    const index = param.logical
    const candle =
      param.time !== undefined && index !== undefined
        ? (this.candles[Math.round(index)] ?? null)
        : null
    for (const l of this.crosshairListeners) l(candle)
  }
}
