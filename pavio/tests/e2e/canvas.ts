import type { Page } from '@playwright/test'

export interface ColorCounts {
  green: number
  red: number
  total: number
}

/**
 * Conta pixels esverdeados/avermelhados numa faixa vertical do painel principal
 * do gráfico. `from`/`to` são frações da altura do painel (0 = topo, 1 = base).
 */
export async function countPanePixels(page: Page, from: number, to: number): Promise<ColorCounts> {
  return page.getByTestId('chart').evaluate(
    (root, [fromFrac, toFrac]) => {
      // O painel principal é o maior canvas do gráfico (os eixos são estreitos).
      const canvases = [...root.querySelectorAll('canvas')]
      const pane = canvases.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a))
      const ctx = pane.getContext('2d')
      if (!ctx) throw new Error('canvas sem contexto 2d')
      const y0 = Math.floor(pane.height * fromFrac)
      const y1 = Math.ceil(pane.height * toFrac)
      const { data } = ctx.getImageData(0, y0, pane.width, Math.max(1, y1 - y0))
      let green = 0
      let red = 0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!
        const g = data[i + 1]!
        if (g - r > 40) green++
        else if (r - g > 40) red++
      }
      return { green, red, total: data.length / 4 }
    },
    [from, to] as const,
  )
}
