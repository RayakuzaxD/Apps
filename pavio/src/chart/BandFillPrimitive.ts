import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts'

type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0]

/** Ponto da faixa: as duas bordas no mesmo horário. */
export interface BandPoint {
  time: number
  a: number
  b: number
}

/**
 * Pinta a área entre duas linhas (ex.: Faixa de Bull Market). Fica presa à
 * série da primeira linha e usa a escala dela para converter preços em pixels.
 */
export class BandFillPrimitive implements ISeriesPrimitive<Time> {
  private points: BandPoint[] = []
  private color = 'rgba(245, 158, 11, 0.2)'
  private visible = true
  private chart: IChartApi | null = null
  private series: ISeriesApi<'Line'> | null = null
  private requestUpdate: (() => void) | null = null
  private readonly view: IPrimitivePaneView

  constructor() {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target: RenderTarget) => this.draw(target),
    }
    this.view = { zOrder: () => 'bottom', renderer: () => renderer }
  }

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.chart = chart
    this.series = series as ISeriesApi<'Line'>
    this.requestUpdate = requestUpdate
  }

  detached() {
    this.chart = null
    this.series = null
    this.requestUpdate = null
  }

  paneViews() {
    return [this.view]
  }

  setData(points: BandPoint[]) {
    this.points = points
    this.requestUpdate?.()
  }

  setStyle(color: string, visible: boolean) {
    this.color = color
    this.visible = visible
    this.requestUpdate?.()
  }

  private draw(target: RenderTarget) {
    const chart = this.chart
    const series = this.series
    if (!chart || !series || !this.visible || this.points.length < 2) return
    const timeScale = chart.timeScale()
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.fillStyle = this.color
      // Desenha trechos contínuos (pontos sem coordenada quebram a faixa).
      let upper: [number, number][] = []
      let lower: [number, number][] = []
      const flush = () => {
        if (upper.length > 1) {
          ctx.beginPath()
          upper.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
          for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i]![0], lower[i]![1])
          ctx.closePath()
          ctx.fill()
        }
        upper = []
        lower = []
      }
      for (const p of this.points) {
        const x = timeScale.timeToCoordinate(p.time as Time)
        const ya = series.priceToCoordinate(p.a)
        const yb = series.priceToCoordinate(p.b)
        if (x === null || ya === null || yb === null) {
          flush()
          continue
        }
        upper.push([x, ya])
        lower.push([x, yb])
      }
      flush()
    })
  }
}
