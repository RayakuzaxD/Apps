import type { IChartApi, ISeriesApi, Logical, MouseEventParams, Time } from 'lightweight-charts'
import { fibLevels, type Point } from '../domain/drawings/geometry'
import {
  POINTS_PER_KIND,
  type AnchorPoint,
  type Drawing,
  type DrawingKind,
  type DrawingTool,
} from '../domain/drawings/types'
import { logicalToTime, timeToLogical } from '../chart/timeMapping'
import { DrawingsPrimitive, type DrawingsScene } from './DrawingsPrimitive'
import { hitTest, type Hit, type ProjectedDrawing } from './hitTest'

export interface DrawingCallbacks {
  onCreate: (kind: DrawingKind, points: AnchorPoint[]) => void
  onMove: (id: string, points: AnchorPoint[]) => void
  onSelect: (id: string | null) => void
  /** Pontos já marcados no desenho em construção (para a dica na tela). */
  onDraftChange: (pointCount: number) => void
}

export interface DrawingContext {
  chart: IChartApi
  series: ISeriesApi<'Candlestick'>
  container: HTMLElement
  /** Tempos reais (s UTC) dos candles atuais e duração do intervalo. */
  getTimes: () => readonly number[]
  getIntervalSeconds: () => number
  formatPrice: (price: number) => string
  getBackground: () => string
}

interface Draft {
  kind: DrawingKind
  points: AnchorPoint[]
  hover: AnchorPoint | null
}

interface Drag {
  hit: Hit
  pointerId: number
  start: Point
  original: AnchorPoint[]
  current: AnchorPoint[]
  moved: boolean
}

const PREVIEW_ID = '__preview__'
/** Deslocamento máximo (px) entre apertar e soltar para contar como clique. */
const CLICK_SLOP = 4

/**
 * Interação de desenho no painel principal:
 * - com uma ferramenta ativa, cada clique fixa um ponto (o preview segue o mouse);
 * - no modo cursor, clicar seleciona; arrastar move uma alça ou o desenho inteiro.
 * Tempos são encaixados nas barras; preços são livres.
 */
export class DrawingController {
  private readonly ctx: DrawingContext
  private readonly callbacks: DrawingCallbacks
  private readonly primitive: DrawingsPrimitive
  private drawings: Drawing[] = []
  private tool: DrawingTool = 'cursor'
  private selectedId: string | null = null
  private draft: Draft | null = null
  private drag: Drag | null = null
  private press: { pointerId: number; x: number; y: number } | null = null

  constructor(ctx: DrawingContext, callbacks: DrawingCallbacks) {
    this.ctx = ctx
    this.callbacks = callbacks
    this.primitive = new DrawingsPrimitive(() => this.buildScene())
    ctx.series.attachPrimitive(this.primitive)
    ctx.chart.subscribeCrosshairMove(this.handleMove)
    // Captura: decide antes do gráfico se o clique é num desenho (e então não arrasta o gráfico).
    ctx.container.addEventListener('pointerdown', this.handlePointerDown, { capture: true })
  }

  setDrawings(drawings: Drawing[]) {
    this.drawings = drawings
    if (this.drag && !drawings.some((d) => d.id === this.drag!.hit.id)) this.endDrag(false)
    this.primitive.invalidate()
  }

  setSelected(id: string | null) {
    this.selectedId = id
    this.primitive.invalidate()
  }

  setTool(tool: DrawingTool) {
    if (tool === this.tool) return
    this.tool = tool
    this.draft = tool === 'cursor' ? null : { kind: tool, points: [], hover: null }
    this.callbacks.onDraftChange(0)
    this.primitive.invalidate()
  }

  /** Descarta o desenho em construção (Escape). Retorna se havia algo a cancelar. */
  cancelDraft(): boolean {
    if (!this.draft || this.draft.points.length === 0) return false
    this.draft = { ...this.draft, points: [], hover: null }
    this.callbacks.onDraftChange(0)
    this.primitive.invalidate()
    return true
  }

  invalidate() {
    this.primitive.invalidate()
  }

  destroy() {
    this.endDrag(false)
    this.ctx.container.removeEventListener('pointerdown', this.handlePointerDown, { capture: true })
    window.removeEventListener('pointerup', this.handlePressEnd)
    this.ctx.chart.unsubscribeCrosshairMove(this.handleMove)
    this.ctx.series.detachPrimitive(this.primitive)
  }

  // ---- Conversões --------------------------------------------------------

  private toPixel(p: AnchorPoint): Point | null {
    const logical = timeToLogical(this.ctx.getTimes(), this.ctx.getIntervalSeconds(), p.time)
    if (logical === null) return null
    const x = this.ctx.chart.timeScale().logicalToCoordinate(logical as Logical)
    const y = this.ctx.series.priceToCoordinate(p.price)
    return x === null || y === null ? null : { x, y }
  }

  /** Pixel -> ponto ancorado, com o tempo encaixado na barra mais próxima. */
  private toAnchor(p: Point): AnchorPoint | null {
    const logical = this.ctx.chart.timeScale().coordinateToLogical(p.x)
    const price = this.ctx.series.coordinateToPrice(p.y)
    if (logical === null || price === null) return null
    const time = logicalToTime(
      this.ctx.getTimes(),
      this.ctx.getIntervalSeconds(),
      Math.round(logical),
    )
    return time === null ? null : { time, price }
  }

  private project(id: string, kind: DrawingKind, points: AnchorPoint[]): ProjectedDrawing | null {
    const pixels: Point[] = []
    for (const p of points) {
      const px = this.toPixel(p)
      if (!px) return null
      pixels.push(px)
    }
    const projected: ProjectedDrawing = { id, kind, points: pixels }
    if (kind === 'fib' && points.length === 2) {
      const ys = fibLevels(points[0]!.price, points[1]!.price).map((l) =>
        this.ctx.series.priceToCoordinate(l.price),
      )
      if (ys.some((y) => y === null)) return null
      projected.levelYs = ys as number[]
    }
    return projected
  }

  private pricesFor(kind: DrawingKind, points: AnchorPoint[]): number[] {
    if (kind === 'fib' && points.length === 2) {
      return fibLevels(points[0]!.price, points[1]!.price).map((l) => l.price)
    }
    return points.map((p) => p.price)
  }

  private buildScene(): DrawingsScene {
    const prices = new Map<string, number[]>()
    const drawings: ProjectedDrawing[] = []
    for (const d of this.drawings) {
      const points = this.drag?.hit.id === d.id ? this.drag.current : d.points
      const projected = this.project(d.id, d.kind, points)
      if (!projected) continue
      drawings.push(projected)
      prices.set(d.id, this.pricesFor(d.kind, points))
    }

    let preview: ProjectedDrawing | null = null
    const draft = this.draft
    if (draft && draft.hover && draft.points.length > 0) {
      const points = [...draft.points, draft.hover]
      preview = this.project(PREVIEW_ID, draft.kind, points)
      prices.set(PREVIEW_ID, this.pricesFor(draft.kind, points))
    }

    return {
      drawings,
      preview,
      selectedId: this.selectedId,
      prices,
      background: this.ctx.getBackground(),
      formatPrice: this.ctx.formatPrice,
    }
  }

  // ---- Criação -----------------------------------------------------------

  private readonly handleMove = (param: MouseEventParams<Time>) => {
    if (!this.draft || this.draft.points.length === 0) return
    const inMainPane = param.point && (param.paneIndex ?? 0) === 0
    const hover = inMainPane ? this.toAnchor(param.point!) : null
    this.draft = { ...this.draft, hover }
    this.primitive.invalidate()
  }

  /**
   * Cliques são detectados aqui (apertar e soltar quase no mesmo lugar), e não
   * pelo subscribeClick do gráfico: a biblioteca descarta um segundo clique em
   * menos de 500 ms (tratado como tentativa de duplo clique), o que perderia o
   * segundo ponto de quem desenha rápido.
   */
  private readonly handlePressEnd = (e: PointerEvent) => {
    const press = this.press
    if (!press || e.pointerId !== press.pointerId) return
    this.press = null
    window.removeEventListener('pointerup', this.handlePressEnd)
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP) return
    const p = this.localPoint(e)
    if (p) this.place(p)
  }

  private place(point: Point) {
    const draft = this.draft
    if (!draft) return
    const anchor = this.toAnchor(point)
    if (!anchor) return

    const points = [...draft.points, anchor]
    if (points.length < POINTS_PER_KIND[draft.kind]) {
      this.draft = { ...draft, points, hover: anchor }
      this.callbacks.onDraftChange(points.length)
      this.primitive.invalidate()
      return
    }
    const [first, second] = points
    if (second && first!.time === second.time && first!.price === second.price) return
    this.draft = { kind: draft.kind, points: [], hover: null }
    this.callbacks.onDraftChange(0)
    this.callbacks.onCreate(draft.kind, points)
  }

  // ---- Seleção e arraste -------------------------------------------------

  /** Ponto do evento relativo ao painel principal, ou null se fora dele. */
  private localPoint(e: PointerEvent): Point | null {
    const pane = this.ctx.chart.panes()[0]?.getHTMLElement()
    if (!pane) return null
    const rect = pane.getBoundingClientRect()
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const width = this.ctx.chart.timeScale().width()
    if (p.x < 0 || p.y < 0 || p.x > width || p.y > rect.height) return null
    return p
  }

  private readonly handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.drag) return
    const p = this.localPoint(e)
    if (!p) return

    if (this.tool !== 'cursor') {
      // Não impede o gráfico de rolar: só vira ponto se soltar sem arrastar.
      this.press = { pointerId: e.pointerId, x: e.clientX, y: e.clientY }
      window.addEventListener('pointerup', this.handlePressEnd)
      return
    }

    const scene = this.buildScene()
    const hit = hitTest(scene.drawings, p, this.selectedId)
    if (!hit) {
      if (this.selectedId) this.callbacks.onSelect(null)
      return
    }
    const drawing = this.drawings.find((d) => d.id === hit.id)
    if (!drawing) return

    // Impede o gráfico de começar a rolar (inclusive os eventos de mouse derivados).
    e.preventDefault()
    e.stopPropagation()
    if (this.selectedId !== hit.id) this.callbacks.onSelect(hit.id)

    this.drag = {
      hit,
      pointerId: e.pointerId,
      start: p,
      original: drawing.points,
      current: drawing.points,
      moved: false,
    }
    this.ctx.chart.applyOptions({ handleScroll: false, handleScale: false })
    window.addEventListener('pointermove', this.handleDragMove)
    window.addEventListener('pointerup', this.handleDragEnd)
    window.addEventListener('pointercancel', this.handleDragCancel)
  }

  private readonly handleDragMove = (e: PointerEvent) => {
    const drag = this.drag
    if (!drag || e.pointerId !== drag.pointerId) return
    const pane = this.ctx.chart.panes()[0]?.getHTMLElement()
    if (!pane) return
    const rect = pane.getBoundingClientRect()
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 3) return

    const next = this.draggedPoints(drag, p)
    if (!next) return
    drag.current = next
    drag.moved = true
    this.primitive.invalidate()
  }

  private draggedPoints(drag: Drag, p: Point): AnchorPoint[] | null {
    if (typeof drag.hit.part === 'number') {
      const anchor = this.toAnchor(p)
      if (!anchor) return null
      return drag.original.map((pt, i) => (i === drag.hit.part ? anchor : pt))
    }

    // Corpo: desloca todos os pontos em barras inteiras e no preço.
    const ts = this.ctx.chart.timeScale()
    const l0 = ts.coordinateToLogical(drag.start.x)
    const l1 = ts.coordinateToLogical(p.x)
    const p0 = this.ctx.series.coordinateToPrice(drag.start.y)
    const p1 = this.ctx.series.coordinateToPrice(p.y)
    if (l0 === null || l1 === null || p0 === null || p1 === null) return null
    const dLogical = Math.round(l1 - l0)
    const dPrice = p1 - p0
    const times = this.ctx.getTimes()
    const interval = this.ctx.getIntervalSeconds()

    const moved: AnchorPoint[] = []
    for (const pt of drag.original) {
      const logical = timeToLogical(times, interval, pt.time)
      const time = logical === null ? null : logicalToTime(times, interval, logical + dLogical)
      if (time === null) return null
      moved.push({ time, price: pt.price + dPrice })
    }
    return moved
  }

  private readonly handleDragEnd = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return
    this.endDrag(true)
  }

  private readonly handleDragCancel = () => this.endDrag(false)

  private endDrag(commit: boolean) {
    const drag = this.drag
    if (!drag) return
    this.drag = null
    window.removeEventListener('pointermove', this.handleDragMove)
    window.removeEventListener('pointerup', this.handleDragEnd)
    window.removeEventListener('pointercancel', this.handleDragCancel)
    this.ctx.chart.applyOptions({ handleScroll: true, handleScale: true })
    if (commit && drag.moved) this.callbacks.onMove(drag.hit.id, drag.current)
    this.primitive.invalidate()
  }
}
