import {
  HistogramSeries,
  LineSeries,
  LineStyle,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
  type WhitespaceData,
} from 'lightweight-charts'
import type { Series } from '../domain/indicators/math'
import { INDICATORS, type IndicatorConfig, type OutputDef } from '../domain/indicators/registry'
import type { ChartTheme } from './theme'
import { withAlpha } from './volume'

/** Proporção de altura de cada painel de indicador em relação ao painel principal. */
export const MAIN_PANE_STRETCH = 3
export const INDICATOR_PANE_STRETCH = 1

const HISTOGRAM_ALPHA = 0.6

export interface IndicatorViewContext {
  chart: IChartApi
  theme: ChartTheme
  /** Formata valores em unidades de preço (overlays e MACD). */
  formatPrice: (value: number) => string
}

type OutputSeries = ISeriesApi<'Line'> | ISeriesApi<'Histogram'>

export type TimeAt = (index: number) => number

/**
 * Séries de um indicador no gráfico. Overlays ficam no painel principal;
 * indicadores de painel criam um painel próprio abaixo dos existentes.
 */
export class IndicatorView {
  private config: IndicatorConfig
  private theme: ChartTheme
  private readonly chart: IChartApi
  private readonly series = new Map<string, OutputSeries>()
  private levelLines: IPriceLine[] = []
  private lastData: { timeAt: TimeAt; outputs: Record<string, Series>; length: number } | null =
    null

  constructor(config: IndicatorConfig, ctx: IndicatorViewContext) {
    this.config = config
    this.theme = ctx.theme
    this.chart = ctx.chart
    const def = INDICATORS[config.type]

    let paneIndex = def.placement === 'overlay' ? 0 : ctx.chart.panes().length
    for (const output of def.outputs) {
      const s = this.createSeries(output, paneIndex, ctx)
      this.series.set(output.key, s)
      paneIndex = s.getPane().paneIndex()
    }

    if (def.placement === 'pane') {
      const panes = ctx.chart.panes()
      panes[0]?.setStretchFactor(MAIN_PANE_STRETCH)
      panes[paneIndex]?.setStretchFactor(INDICATOR_PANE_STRETCH)
    }
    if (def.range) {
      // Escala fixa (ex.: IFR 0–100): margens pequenas, senão o eixo mostra valores fora da faixa.
      this.series
        .values()
        .next()
        .value?.priceScale()
        .applyOptions({ scaleMargins: { top: 0.06, bottom: 0.06 } })
    }
    this.applyStyle()
  }

  get id(): string {
    return this.config.id
  }

  getConfig(): IndicatorConfig {
    return this.config
  }

  /** Elemento HTML do painel do indicador (para posicionar a legenda). */
  getPaneElement(): HTMLElement | null {
    const first = this.series.values().next().value
    return first ? first.getPane().getHTMLElement() : null
  }

  setConfig(config: IndicatorConfig) {
    this.config = config
    this.applyStyle()
  }

  applyTheme(theme: ChartTheme) {
    this.theme = theme
    this.applyStyle()
    // Histogramas têm cor por barra: reenviar os dados com as cores novas.
    if (this.lastData)
      this.setData(this.lastData.timeAt, this.lastData.outputs, this.lastData.length)
  }

  setData(timeAt: TimeAt, outputs: Record<string, Series>, length: number) {
    this.lastData = { timeAt, outputs, length }
    for (const [key, s] of this.series) {
      const values = outputs[key] ?? []
      const points = Array.from({ length }, (_, i) => this.point(key, values, i, timeAt))
      ;(s as ISeriesApi<'Line'>).setData(points as LineData<Time>[])
    }
  }

  /** Atualiza os pontos a partir de `fromIndex` (tempo real; índices crescentes). */
  updateFrom(timeAt: TimeAt, outputs: Record<string, Series>, length: number, fromIndex: number) {
    this.lastData = { timeAt, outputs, length }
    for (const [key, s] of this.series) {
      const values = outputs[key] ?? []
      for (let i = Math.max(0, fromIndex); i < length; i++) {
        ;(s as ISeriesApi<'Line'>).update(this.point(key, values, i, timeAt) as LineData<Time>)
      }
    }
  }

  destroy() {
    for (const s of this.series.values()) this.chart.removeSeries(s)
    this.series.clear()
    this.levelLines = []
  }

  private createSeries(output: OutputDef, paneIndex: number, ctx: IndicatorViewContext) {
    const def = INDICATORS[this.config.type]
    const priceFormat =
      def.range !== undefined
        ? {
            type: 'custom' as const,
            formatter: (v: number) => v.toFixed(2).replace('.', ','),
            minMove: 0.01,
          }
        : { type: 'custom' as const, formatter: ctx.formatPrice, minMove: 1e-8 }
    const autoscaleInfoProvider = def.range
      ? () => ({ priceRange: { minValue: def.range!.min, maxValue: def.range!.max } })
      : undefined

    if (output.style === 'histogram') {
      return ctx.chart.addSeries(
        HistogramSeries,
        { priceFormat, priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      )
    }
    return ctx.chart.addSeries(
      LineSeries,
      {
        priceFormat,
        autoscaleInfoProvider,
        lineWidth: this.config.type === 'bb' ? 1 : 2,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerRadius: 3,
      },
      paneIndex,
    )
  }

  private applyStyle() {
    const def = INDICATORS[this.config.type]
    for (const output of def.outputs) {
      const s = this.series.get(output.key)
      if (!s) continue
      const color = output.colorParam ? String(this.config.params[output.colorParam]) : undefined
      s.applyOptions({ visible: this.config.visible, ...(color ? { color } : {}) })
    }
    this.syncLevels()
  }

  private syncLevels() {
    const first = this.series.get(INDICATORS[this.config.type].outputs[0]!.key)
    if (!first) return
    for (const line of this.levelLines) first.removePriceLine(line)
    this.levelLines = []
    if (this.config.type !== 'rsi' || !this.config.visible) return
    for (const key of ['upperLevel', 'lowerLevel']) {
      this.levelLines.push(
        first.createPriceLine({
          price: Number(this.config.params[key]),
          color: this.theme.text,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '',
        }),
      )
    }
  }

  private point(
    key: string,
    values: Series,
    index: number,
    timeAt: TimeAt,
  ): LineData<Time> | HistogramData<Time> | WhitespaceData<Time> {
    const time = timeAt(index) as UTCTimestamp
    const value = values[index]
    if (value === null || value === undefined) return { time }
    if (key === 'histogram') {
      const color = withAlpha(value >= 0 ? this.theme.up : this.theme.down, HISTOGRAM_ALPHA)
      return { time, value, color }
    }
    return { time, value }
  }
}
