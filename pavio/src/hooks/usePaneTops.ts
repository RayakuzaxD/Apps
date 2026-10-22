import { useEffect, useState, type RefObject } from 'react'
import type { ChartController } from '../chart/ChartController'

type Tops = Record<string, number>

function sameTops(a: Tops, b: Tops): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

/**
 * Posição vertical (px, relativa a `wrapperRef`) do painel de cada indicador,
 * para alinhar a legenda ao topo do painel. Remede quando o gráfico ou um
 * painel muda de tamanho (inclusive ao arrastar o divisor entre painéis).
 */
export function usePaneTops(
  controller: ChartController | null,
  wrapperRef: RefObject<HTMLElement | null>,
  ids: readonly string[],
): Tops {
  const [tops, setTops] = useState<Tops>({})
  const key = ids.join('|')

  useEffect(() => {
    const wrapper = wrapperRef.current
    const list = key ? key.split('|') : []
    if (!controller || !wrapper || list.length === 0) {
      setTops((prev) => (Object.keys(prev).length === 0 ? prev : {}))
      return
    }

    const measure = () => {
      const base = wrapper.getBoundingClientRect().top
      const next: Tops = {}
      for (const id of list) {
        const el = controller.getIndicatorPaneElement(id)
        if (el) next[id] = Math.round(el.getBoundingClientRect().top - base)
      }
      setTops((prev) => (sameTops(prev, next) ? prev : next))
    }

    const observer = new ResizeObserver(measure)
    observer.observe(wrapper)
    for (const id of list) {
      const el = controller.getIndicatorPaneElement(id)
      if (!el) continue
      observer.observe(el)
      const canvas = el.querySelector('canvas')
      if (canvas) observer.observe(canvas)
    }
    // A biblioteca refaz o layout dos painéis no próximo quadro.
    const frame = requestAnimationFrame(measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [controller, wrapperRef, key])

  return tops
}
