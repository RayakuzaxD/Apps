import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts'
import { FIB_RATIOS } from '../domain/drawings/geometry'
import type { Point } from '../domain/drawings/geometry'
import type { ProjectedDrawing } from './hitTest'
import { DRAWING_COLORS, FIB_LEVEL_COLORS, HANDLE_RADIUS, LINE_WIDTH } from './style'

type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0]

/** O que desenhar, já em pixels do painel principal. */
export interface DrawingsScene {
  drawings: ProjectedDrawing[]
  /** Desenho em construção (segue o mouse). */
  preview: ProjectedDrawing | null
  selectedId: string | null
  /** Preços originais, para rótulos (Fibonacci e linha horizontal). */
  prices: Map<string, number[]>
  background: string
  formatPrice: (price: number) => string
}

export type SceneProvider = () => DrawingsScene

function hexAlpha(color: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${a}` : color
}

class DrawingsRenderer implements IPrimitivePaneRenderer {
  private readonly scene: DrawingsScene

  constructor(scene: DrawingsScene) {
    this.scene = scene
  }

  draw(target: RenderTarget) {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { drawings, preview, selectedId } = this.scene
      for (const d of drawings) this.drawOne(ctx, d, mediaSize.width, d.id === selectedId)
      if (preview) this.drawOne(ctx, preview, mediaSize.width, true)
    })
  }

  private drawOne(
    ctx: CanvasRenderingContext2D,
    d: ProjectedDrawing,
    width: number,
    selected: boolean,
  ) {
    ctx.save()
    ctx.lineCap = 'round'
    switch (d.kind) {
      case 'trend':
        this.line(
          ctx,
          d.points[0],
          d.points[1],
          DRAWING_COLORS.trend,
          LINE_WIDTH + (selected ? 1 : 0),
        )
        break
      case 'horizontal': {
        const p = d.points[0]
        if (p) {
          this.line(
            ctx,
            { x: 0, y: p.y },
            { x: width, y: p.y },
            DRAWING_COLORS.horizontal,
            LINE_WIDTH + (selected ? 1 : 0),
          )
        }
        break
      }
      case 'fib':
        this.fib(ctx, d)
        break
    }
    if (selected) for (const p of d.points) this.handle(ctx, p, DRAWING_COLORS[d.kind])
    ctx.restore()
  }

  private fib(ctx: CanvasRenderingContext2D, d: ProjectedDrawing) {
    const [a, b] = d.points
    const ys = d.levelYs
    if (!a || !b || !ys) return
    const left = Math.min(a.x, b.x)
    const right = Math.max(a.x, b.x)
    const prices = this.scene.prices.get(d.id) ?? []

    // Faixas translúcidas entre níveis consecutivos.
    for (let i = 0; i < ys.length - 1; i++) {
      ctx.fillStyle = hexAlpha(FIB_LEVEL_COLORS[i + 1]!, 0.08)
      const top = Math.min(ys[i]!, ys[i + 1]!)
      ctx.fillRect(left, top, right - left, Math.abs(ys[i + 1]! - ys[i]!))
    }

    ys.forEach((y, i) => this.line(ctx, { x: left, y }, { x: right, y }, FIB_LEVEL_COLORS[i]!, 1))

    ctx.setLineDash([4, 4])
    this.line(ctx, a, b, DRAWING_COLORS.fib, 1)
    ctx.setLineDash([])

    // Rótulos por último, com fundo translúcido para continuarem legíveis sobre os candles.
    ctx.font = '11px system-ui, sans-serif'
    ctx.textBaseline = 'bottom'
    ys.forEach((y, i) => {
      const price = prices[i]
      const label =
        price === undefined
          ? String(FIB_RATIOS[i])
          : `${FIB_RATIOS[i]} (${this.scene.formatPrice(price)})`
      const width = ctx.measureText(label).width
      ctx.fillStyle = hexAlpha(this.scene.background, 0.8)
      ctx.fillRect(left + 2, y - 15, width + 4, 13)
      ctx.fillStyle = FIB_LEVEL_COLORS[i]!
      ctx.fillText(label, left + 4, y - 2)
    })
  }

  private line(
    ctx: CanvasRenderingContext2D,
    a: Point | undefined,
    b: Point | undefined,
    color: string,
    width: number,
  ) {
    if (!a || !b) return
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  private handle(ctx: CanvasRenderingContext2D, p: Point, color: string) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = this.scene.background
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = color
    ctx.stroke()
  }
}

class DrawingsPaneView implements IPrimitivePaneView {
  private readonly provider: SceneProvider

  constructor(provider: SceneProvider) {
    this.provider = provider
  }

  zOrder() {
    return 'top' as const
  }

  renderer() {
    return new DrawingsRenderer(this.provider())
  }
}

class HorizontalAxisView implements ISeriesPrimitiveAxisView {
  private readonly y: number
  private readonly label: string

  constructor(y: number, label: string) {
    this.y = y
    this.label = label
  }
  coordinate() {
    return this.y
  }
  text() {
    return this.label
  }
  textColor() {
    return '#ffffff'
  }
  backColor() {
    return DRAWING_COLORS.horizontal
  }
}

/**
 * Primitiva única que desenha todos os desenhos do par atual sobre a série de
 * candles. O estado vem de `provider`, recalculado a cada atualização do gráfico.
 */
export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | null = null
  private readonly provider: SceneProvider
  private readonly paneView: DrawingsPaneView

  constructor(provider: SceneProvider) {
    this.provider = provider
    this.paneView = new DrawingsPaneView(provider)
  }

  attached({ requestUpdate }: SeriesAttachedParameter<Time>) {
    this.requestUpdate = requestUpdate
  }

  detached() {
    this.requestUpdate = null
  }

  /** Pede ao gráfico para redesenhar (após mudar desenhos, seleção ou preview). */
  invalidate() {
    this.requestUpdate?.()
  }

  paneViews() {
    return [this.paneView]
  }

  priceAxisViews() {
    const scene = this.provider()
    const all = scene.preview ? [...scene.drawings, scene.preview] : scene.drawings
    return all
      .filter((d) => d.kind === 'horizontal' && d.points[0])
      .map((d) => {
        const price = scene.prices.get(d.id)?.[0]
        return new HorizontalAxisView(
          d.points[0]!.y,
          price === undefined ? '' : scene.formatPrice(price),
        )
      })
  }
}
