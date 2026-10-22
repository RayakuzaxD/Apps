import type { Page } from '@playwright/test'

/**
 * Verifica se algum canvas do gráfico tem um pixel próximo da cor `hex` num raio
 * de `radius` px CSS ao redor de (x, y) em coordenadas da página.
 */
export async function hasColorNear(
  page: Page,
  x: number,
  y: number,
  hex: string,
  radius = 3,
): Promise<boolean> {
  return page.getByTestId('chart').evaluate(
    (root, [px, py, color, r]) => {
      const target = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
      for (const canvas of root.querySelectorAll('canvas')) {
        const rect = canvas.getBoundingClientRect()
        if (px < rect.left || px > rect.right || py < rect.top || py > rect.bottom) continue
        const ctx = canvas.getContext('2d')
        if (!ctx || rect.width === 0) continue
        const scale = canvas.width / rect.width
        const x0 = Math.max(0, Math.floor((px - rect.left - r) * scale))
        const y0 = Math.max(0, Math.floor((py - rect.top - r) * scale))
        const size = Math.ceil(2 * r * scale) + 1
        const { data } = ctx.getImageData(x0, y0, size, size)
        for (let i = 0; i < data.length; i += 4) {
          const d = Math.hypot(
            data[i]! - target[0]!,
            data[i + 1]! - target[1]!,
            data[i + 2]! - target[2]!,
          )
          if (data[i + 3]! > 200 && d < 40) return true
        }
      }
      return false
    },
    [x, y, hex, radius] as const,
  )
}

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
