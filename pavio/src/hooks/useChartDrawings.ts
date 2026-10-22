import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { ChartController } from '../chart/ChartController'
import type { DrawingController } from '../drawings/DrawingController'
import { useDrawingsStore } from '../store/drawingsStore'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Liga as ferramentas de desenho ao gráfico e à store:
 * desenhos do par atual, ferramenta ativa, seleção e atalhos de teclado
 * (Esc cancela/desseleciona, Delete/Backspace remove o selecionado).
 */
export function useChartDrawings(
  controller: ChartController | null,
  containerRef: RefObject<HTMLElement | null>,
  symbol: string,
): { draftPoints: number } {
  const [drawingCtl, setDrawingCtl] = useState<DrawingController | null>(null)
  const [draftPoints, setDraftPoints] = useState(0)
  const symbolRef = useRef(symbol)

  const allDrawings = useDrawingsStore((s) => s.drawings)
  const tool = useDrawingsStore((s) => s.tool)
  const selectedId = useDrawingsStore((s) => s.selectedId)
  const drawings = useMemo(
    () => allDrawings.filter((d) => d.symbol === symbol),
    [allDrawings, symbol],
  )

  useEffect(() => {
    symbolRef.current = symbol
  }, [symbol])

  useEffect(() => {
    const container = containerRef.current
    if (!controller || !container) return
    const store = useDrawingsStore.getState
    const ctl = controller.createDrawingController(container, {
      onCreate: (kind, points) => {
        const id = store().add(symbolRef.current, kind, points)
        store().setTool('cursor')
        if (id) store().select(id)
      },
      onMove: (id, points) => store().movePoints(id, points),
      onSelect: (id) => store().select(id),
      onDraftChange: setDraftPoints,
    })
    setDrawingCtl(ctl)
    return () => {
      ctl.destroy()
      setDrawingCtl(null)
    }
  }, [controller, containerRef])

  useEffect(() => {
    drawingCtl?.setDrawings(drawings)
  }, [drawingCtl, drawings])

  useEffect(() => {
    drawingCtl?.setTool(tool)
  }, [drawingCtl, tool])

  useEffect(() => {
    drawingCtl?.setSelected(selectedId)
  }, [drawingCtl, selectedId])

  // Trocar de par descarta a seleção e o desenho em construção.
  useEffect(() => {
    const { select } = useDrawingsStore.getState()
    select(null)
    drawingCtl?.cancelDraft()
  }, [drawingCtl, symbol])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.defaultPrevented) return
      const state = useDrawingsStore.getState()
      if (e.key === 'Escape') {
        if (drawingCtl?.cancelDraft()) return
        if (state.tool !== 'cursor') state.setTool('cursor')
        else if (state.selectedId) state.select(null)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
        e.preventDefault()
        state.remove(state.selectedId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawingCtl])

  return { draftPoints }
}
