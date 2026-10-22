import { expect, test, type Page } from '@playwright/test'
import { hasColorNear } from './canvas'
import { mockBinance } from './mockBinance'

const TREND = '#6366f1'
const HORIZONTAL = '#e8833a'
const FIB_HALF = '#22c55e'

interface StoredDrawing {
  id: string
  symbol: string
  kind: string
  points: { time: number; price: number }[]
}

async function storedDrawings(page: Page): Promise<StoredDrawing[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('pavio:drawings')
    return raw ? JSON.parse(raw).state.drawings : []
  })
}

async function setup(page: Page) {
  await mockBinance(page)
  await page.goto('/')
  await expect(page.getByTestId('legend-F')).not.toBeEmpty()
  const box = (await page.getByTestId('chart').boundingBox())!
  /** Ponto em frações da área do gráfico. */
  const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy })
  return { box, at }
}

async function clickAt(page: Page, p: { x: number; y: number }) {
  await page.mouse.move(p.x, p.y)
  await page.mouse.click(p.x, p.y)
}

/** Tira o mouse do gráfico (o crosshair poderia cobrir os pixels verificados). */
const away = (page: Page) => page.mouse.move(1, 1)

test.describe('Etapa 4: ferramentas de desenho', () => {
  test('linha de tendência: dois cliques, fica selecionada e Delete remove', async ({ page }) => {
    const { at } = await setup(page)
    await page.getByRole('button', { name: 'Linha de tendência' }).click()
    const hint = page.getByTestId('drawing-hint')
    await expect(hint).toContainText('clique no ponto inicial')

    const a = at(0.3, 0.45)
    const b = at(0.6, 0.25)
    await clickAt(page, a)
    await expect(hint).toContainText('clique no ponto final')
    await clickAt(page, b)
    await expect(hint).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Cursor/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const [drawing] = await storedDrawings(page)
    expect(drawing).toMatchObject({ symbol: 'BTCUSDT', kind: 'trend' })
    expect(drawing!.points).toHaveLength(2)
    // Tempos encaixados nas barras de 1h; o segundo ponto fica à direita do primeiro.
    for (const p of drawing!.points) expect(p.time % 3600).toBe(0)
    expect(drawing!.points[1]!.time).toBeGreaterThan(drawing!.points[0]!.time)
    expect(drawing!.points[1]!.price).toBeGreaterThan(drawing!.points[0]!.price)

    await away(page)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    await expect.poll(() => hasColorNear(page, mid.x, mid.y, TREND)).toBe(true)
    await expect(page.getByRole('button', { name: /Remover desenho selecionado/ })).toBeEnabled()

    await page.keyboard.press('Delete')
    expect(await storedDrawings(page)).toEqual([])
    await expect.poll(() => hasColorNear(page, mid.x, mid.y, TREND)).toBe(false)
  })

  test('linha horizontal: um clique, persiste e acompanha troca de timeframe', async ({ page }) => {
    const { at } = await setup(page)
    await page.getByRole('button', { name: 'Linha horizontal' }).click()
    await expect(page.getByTestId('drawing-hint')).toContainText('clique no preço desejado')
    const p = at(0.5, 0.4)
    await clickAt(page, p)
    await away(page)

    const [drawing] = await storedDrawings(page)
    expect(drawing).toMatchObject({ kind: 'horizontal', symbol: 'BTCUSDT' })
    // Linha cobre toda a largura do painel.
    await expect.poll(() => hasColorNear(page, at(0.05, 0).x, p.y, HORIZONTAL)).toBe(true)
    await expect.poll(() => hasColorNear(page, at(0.85, 0).x, p.y, HORIZONTAL)).toBe(true)

    await page.reload()
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()
    await expect.poll(() => hasColorNear(page, at(0.3, 0).x, p.y, HORIZONTAL, 4)).toBe(true)

    // No 4h o preço é o mesmo; a linha continua no gráfico (mesmo que em outra altura).
    await page.getByRole('button', { name: '4h', exact: true }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('4h')
    expect(await storedDrawings(page)).toEqual([drawing])
  })

  test('Fibonacci: dois cliques desenham os níveis entre os pontos', async ({ page }) => {
    const { at } = await setup(page)
    // Os níveis são de preço: só em escala linear o 0,5 fica no meio dos pontos em pixels.
    await page.getByTestId('log-scale').click()
    await expect(page.getByTestId('log-scale')).toHaveAttribute('aria-pressed', 'false')
    await page.getByRole('button', { name: 'Retração de Fibonacci' }).click()
    const a = at(0.25, 0.6)
    const b = at(0.55, 0.2)
    await clickAt(page, a)
    await clickAt(page, b)
    await away(page)

    const [drawing] = await storedDrawings(page)
    expect(drawing!.kind).toBe('fib')
    // Nível 0,5 fica no meio dos dois pontos (verde), dentro da faixa horizontal.
    const midY = (a.y + b.y) / 2
    await expect.poll(() => hasColorNear(page, a.x + 40, midY, FIB_HALF, 2)).toBe(true)
    await expect.poll(() => hasColorNear(page, b.x - 40, midY, FIB_HALF, 2)).toBe(true)
    // Fora da faixa entre os pontos não há linhas de nível.
    expect(await hasColorNear(page, b.x + 60, midY, FIB_HALF, 2)).toBe(false)
  })

  test('arrastar move o desenho sem rolar o gráfico; alça move só o ponto', async ({ page }) => {
    const { at } = await setup(page)
    // Linha de tendência íngreme: serve de referência fixa na tela.
    await page.getByRole('button', { name: 'Linha de tendência' }).click()
    const a = at(0.2, 0.75)
    const b = at(0.3, 0.45)
    await clickAt(page, a)
    await clickAt(page, b)
    await page.keyboard.press('Escape') // desseleciona

    await page.getByRole('button', { name: 'Linha horizontal' }).click()
    const p = at(0.6, 0.25)
    await clickAt(page, p)
    await page.keyboard.press('Escape')
    const horizontalOf = async () =>
      (await storedDrawings(page)).find((d) => d.kind === 'horizontal')!
    const before = await horizontalOf()

    // Arrasta o corpo da linha na diagonal (120px para a direita, 80px para baixo).
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    await page.mouse.move(p.x + 60, p.y + 40, { steps: 4 })
    await page.mouse.move(p.x + 120, p.y + 80, { steps: 4 })
    await page.mouse.up()
    await away(page)

    const after = await horizontalOf()
    expect(after.points[0]!.price).toBeLessThan(before.points[0]!.price)
    await expect.poll(() => hasColorNear(page, at(0.1, 0).x, p.y + 80, HORIZONTAL, 3)).toBe(true)
    expect(await hasColorNear(page, at(0.1, 0).x, p.y, HORIZONTAL, 2)).toBe(false)
    // Se o gráfico tivesse rolado junto, a linha de tendência teria saído do lugar.
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    expect(await hasColorNear(page, mid.x, mid.y, TREND, 2)).toBe(true)

    // Alça: seleciona a tendência e arrasta o ponto final; o inicial não muda.
    const trendBefore = (await storedDrawings(page)).find((d) => d.kind === 'trend')!
    await page.mouse.click(mid.x, mid.y)
    await page.mouse.move(b.x, b.y)
    await page.mouse.down()
    await page.mouse.move(b.x + 60, b.y - 60, { steps: 5 })
    await page.mouse.up()
    const trendAfter = (await storedDrawings(page)).find((d) => d.kind === 'trend')!
    expect(trendAfter.points[0]).toEqual(trendBefore.points[0])
    expect(trendAfter.points[1]!.time).toBeGreaterThan(trendBefore.points[1]!.time)
    expect(trendAfter.points[1]!.price).toBeGreaterThan(trendBefore.points[1]!.price)
  })

  test('Esc cancela o desenho em andamento', async ({ page }) => {
    const { at } = await setup(page)
    await page.getByRole('button', { name: 'Linha de tendência' }).click()
    await clickAt(page, at(0.3, 0.3))
    await expect(page.getByTestId('drawing-hint')).toContainText('ponto final')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('drawing-hint')).toContainText('ponto inicial')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('drawing-hint')).toHaveCount(0)
    expect(await storedDrawings(page)).toEqual([])
  })

  test('desenhos são por par e "remover todos" pede confirmação', async ({ page }) => {
    const { at } = await setup(page)
    await page.getByRole('button', { name: 'Linha horizontal' }).click()
    await clickAt(page, at(0.5, 0.35))
    await page.getByRole('button', { name: 'Linha horizontal' }).click()
    await clickAt(page, at(0.5, 0.55))
    await away(page)
    expect(await storedDrawings(page)).toHaveLength(2)

    await page.getByRole('button', { name: /Trocar par/ }).click()
    await page.getByRole('option', { name: /ETH\/USDT/ }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('ETH/USDT')
    await expect(page.getByRole('button', { name: /Remover todos/ })).toBeDisabled()

    await page.getByRole('button', { name: /Trocar par/ }).click()
    await page.getByRole('option', { name: /BTC\/USDT/ }).click()
    await expect(page.getByRole('button', { name: /Remover todos/ })).toBeEnabled()

    page.once('dialog', (dialog) => void dialog.dismiss())
    await page.getByRole('button', { name: /Remover todos/ }).click()
    expect(await storedDrawings(page)).toHaveLength(2)

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Remover todos os 2 desenhos de BTCUSDT')
      void dialog.accept()
    })
    await page.getByRole('button', { name: /Remover todos/ }).click()
    await expect.poll(() => storedDrawings(page)).toEqual([])
  })
})
