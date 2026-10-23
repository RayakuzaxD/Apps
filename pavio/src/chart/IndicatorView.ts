import {
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
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
import { BandFillPrimitive, type BandPoint } from './BandFillPrimitive'
import type { ChartTheme } from './theme'
import { withAlpha } from './volume'

/** Proporção de altura de cada painel de indicador em relação ao painel principal. */
export const MAIN_PANE_STRETCH = 3
export const INDICATOR_PANE_STRETCH = 1

const HISTOGRAM_ALPHA = 0.6
const FILL_ALPHA = 0.28
/** Tendência estável (0) usa o texto do tema, mais apagado. */
const NEUTRAL_ALPHA = 0.55

export interface IndicatorViewContext {
  chart: IChartApi
  theme: ChartTheme
  /** Formata valores em unidades de preço (overlays e MACD). */
  formatPrice: (value: number) => string
}

type OutputSeries = ISeriesApi<'Line'> | ISeriesApi<'Histogram'>

/** Horário (já deslocado para o gráfico) do ponto `index`; além das velas, extrapola. */
export type TimeAt = (index: number) => number

/** Comprimento a desenhar: as velas, ou mais se o indicador projeta pontos à frente. */
function drawLength(outputs: Record<string, Series>, length: number): number {
  let max = length
  for (const values of Object.values(outputs)) max = Math.max(max, values.length)
  return max
}

/**
 * Séries de um indicador no gráfico. Overlays ficam no painel principal;
 * indicadores de painel criam um painel próprio abaixo dos existentes.
 */
export class IndicatorView {
  private config: IndicatorConfig
  private theme: ChartTheme
  private readonly chart: IChartApi
  private readonly series = new Map<string, OutputSeries>()
  private readonly fills = new Map<string, BandFillPrimitive>()
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
      if (output.style === 'hidden') continue
      const s = this.createSeries(output, paneIndex, ctx)
      this.series.set(output.key, s)
      paneIndex = s.getPane().paneIndex()
      if (output.fillTo) {
        const fill = new BandFillPrimitive()
        ;(s as ISeriesApi<'Line'>).attachPrimitive(fill)
        this.fills.set(output.key, fill)
      }
    }

    if (def.placement === 'pane') {
      const panes = ctx.chart.panes()
      panes[0]?.setStretchFactor(MAIN_PANE_STRETCH)
      panes[paneIndex]?.setStretchFactor(INDICATOR_PANE_STRETCH)
      this.keepLinearScale()
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

  /**
   * Painéis próprios (IFR, MACD…) ficam sempre em escala linear, mesmo com o
   * preço em log: a biblioteca leva o modo da escala principal aos painéis.
   */
  keepLinearScale() {
    if (INDICATORS[this.config.type].placement !== 'pane') return
    this.series.values().next().value?.priceScale().applyOptions({ mode: PriceScaleMode.Normal })
  }

  get id(): string {
    return this.config.id
  }

  getConfig(): IndicatorConfig {
    return this.config
  }

  /** As saídas mudaram desde o último envio (ex.: dado externo chegou depois). */
  hasNewOutputs(outputs: Record<string, Series>): boolean {
    return this.lastData?.outputs !== outputs
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
    // Histogramas e linhas por tendência têm cor por ponto: reenviar os dados com as cores novas.
    if (this.lastData)
      this.setData(this.lastData.timeAt, this.lastData.outputs, this.lastData.length)
  }

  setData(timeAt: TimeAt, outputs: Record<string, Series>, length: number) {
    this.lastData = { timeAt, outputs, length }
    const total = drawLength(outputs, length)
    for (const [key, s] of this.series) {
      const points = Array.from({ length: total }, (_, i) => this.point(key, outputs, i, timeAt))
      ;(s as ISeriesApi<'Line'>).setData(points as LineData<Time>[])
    }
    this.syncFills(timeAt, outputs, total)
  }

  /** Atualiza os pontos a partir de `fromIndex` (tempo real; índices crescentes). */
  updateFrom(timeAt: TimeAt, outputs: Record<string, Series>, length: number, fromIndex: number) {
    // Mesmo resultado (série externa reaproveitada): nada a fazer.
    if (this.lastData?.outputs === outputs) return
    // Com pontos à frente das velas, a biblioteca não aceita atualizar o passado: reenviar tudo.
    if (drawLength(outputs, length) > length) {
      this.setData(timeAt, outputs, length)
      return
    }
    this.lastData = { timeAt, outputs, length }
    for (const [key, s] of this.series) {
      for (let i = Math.max(0, fromIndex); i < length; i++) {
        ;(s as ISeriesApi<'Line'>).update(this.point(key, outputs, i, timeAt) as LineData<Time>)
      }
    }
    if (this.fills.size > 0) this.syncFills(timeAt, outputs, length)
  }

  destroy() {
    for (const [key, fill] of this.fills) {
      ;(this.series.get(key) as ISeriesApi<'Line'> | undefined)?.detachPrimitive(fill)
    }
    this.fills.clear()
    for (const s of this.series.values()) this.chart.removeSeries(s)
    this.series.clear()
    this.levelLines = []
  }

  private createSeries(output: OutputDef, paneIndex: number, ctx: IndicatorViewContext) {
    const def = INDICATORS[this.config.type]
    const digits = def.digits ?? (def.range ? 2 : undefined)
    const priceFormat =
      digits !== undefined
        ? {
            type: 'custom' as const,
            formatter: (v: number) => v.toFixed(digits).replace('.', ','),
            minMove: 10 ** -digits,
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
      const fill = this.fills.get(output.key)
      if (fill && output.fillColorParam) {
        fill.setStyle(
          withAlpha(String(this.config.params[output.fillColorParam]), FILL_ALPHA),
          this.config.visible,
        )
      }
    }
    this.syncLevels()
  }

  private syncFills(timeAt: TimeAt, outputs: Record<string, Series>, total: number) {
    for (const output of INDICATORS[this.config.type].outputs) {
      const fill = this.fills.get(output.key)
      if (!fill || !output.fillTo) continue
      const a = outputs[output.key] ?? []
      const b = outputs[output.fillTo] ?? []
      const points: BandPoint[] = []
      for (let i = 0; i < total; i++) {
        const va = a[i]
        const vb = b[i]
        if (va === null || va === undefined || vb === null || vb === undefined) continue
        points.push({ time: timeAt(i), a: va, b: vb })
      }
      fill.setData(points)
    }
  }

  private syncLevels() {
    const def = INDICATORS[this.config.type]
    const firstVisible = def.outputs.find((o) => o.style !== 'hidden')
    const first = firstVisible ? this.series.get(firstVisible.key) : undefined
    if (!first) return
    for (const line of this.levelLines) first.removePriceLine(line)
    this.levelLines = []
    if (!def.levels || !this.config.visible) return
    for (const price of def.levels(this.config.params)) {
      this.levelLines.push(
        first.createPriceLine({
          price,
          color: this.theme.text,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '',
        }),
      )
    }
  }

  private trendColor(trend: number | null | undefined): string {
    if (trend === 1) return this.theme.up
    if (trend === -1) return this.theme.down
    return withAlpha(this.theme.text, NEUTRAL_ALPHA)
  }

  private point(
    key: string,
    outputs: Record<string, Series>,
    index: number,
    timeAt: TimeAt,
  ): LineData<Time> | HistogramData<Time> | WhitespaceData<Time> {
    const time = timeAt(index) as UTCTimestamp
    const value = outputs[key]?.[index]
    if (value === null || value === undefined) return { time }
    if (key === 'histogram') {
      const color = withAlpha(value >= 0 ? this.theme.up : this.theme.down, HISTOGRAM_ALPHA)
      return { time, value, color }
    }
    const trendKey = INDICATORS[this.config.type].outputs.find((o) => o.key === key)?.trendKey
    if (trendKey) return { time, value, color: this.trendColor(outputs[trendKey]?.[index]) }
    return { time, value }
  }
}
