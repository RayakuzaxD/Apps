import { expect, test, type Page } from '@playwright/test'
import { hasColorNear } from './canvas'
import { mockBinance } from './mockBinance'

// Tokens de styles/tokens.css
const LIGHT = { bg: 'rgb(247, 246, 243)', surface: '#ffffff' }
const DARK = { bg: 'rgb(18, 17, 16)', surface: '#1a1917' }

const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor)

const themeAttribute = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.theme ?? null)

/** Confere a cor de fundo do gráfico num canto vazio do painel principal. */
async function chartBackgroundIs(page: Page, hex: string) {
  const box = (await page.getByTestId('chart').boundingBox())!
  return hasColorNear(page, box.x + box.width - 110, box.y + 6, hex, 2)
}

async function chooseTheme(page: Page, label: 'Automático (sistema)' | 'Claro' | 'Escuro') {
  await page.getByRole('button', { name: /^Tema:/ }).click()
  await page.getByRole('menuitemradio', { name: label }).click()
}

test.describe('Etapa 6: tema claro/escuro', () => {
  test('automático segue o tema do sistema, inclusive no gráfico', async ({ page }) => {
    await mockBinance(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()
    await expect(page.getByRole('button', { name: 'Tema: Automático (sistema)' })).toBeVisible()
    expect(await themeAttribute(page)).toBeNull()
    expect(await bodyBackground(page)).toBe(DARK.bg)
    await expect.poll(() => chartBackgroundIs(page, DARK.surface)).toBe(true)

    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => bodyBackground(page)).toBe(LIGHT.bg)
    await expect.poll(() => chartBackgroundIs(page, LIGHT.surface)).toBe(true)
  })

  test('escolha manual vale contra o sistema e fica salva', async ({ page }) => {
    await mockBinance(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()

    await chooseTheme(page, 'Escuro')
    expect(await themeAttribute(page)).toBe('dark')
    expect(await bodyBackground(page)).toBe(DARK.bg)
    await expect.poll(() => chartBackgroundIs(page, DARK.surface)).toBe(true)

    // Mudar o sistema não afeta a escolha manual.
    await page.emulateMedia({ colorScheme: 'light' })
    await page.reload()
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()
    expect(await themeAttribute(page)).toBe('dark')
    await expect.poll(() => chartBackgroundIs(page, DARK.surface)).toBe(true)

    await chooseTheme(page, 'Claro')
    await page.emulateMedia({ colorScheme: 'dark' })
    expect(await bodyBackground(page)).toBe(LIGHT.bg)
    await expect.poll(() => chartBackgroundIs(page, LIGHT.surface)).toBe(true)

    await chooseTheme(page, 'Automático (sistema)')
    expect(await themeAttribute(page)).toBeNull()
    await expect.poll(() => chartBackgroundIs(page, DARK.surface)).toBe(true)
  })

  test('o tema salvo é aplicado antes do app carregar (sem piscar)', async ({ page }) => {
    await mockBinance(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await chooseTheme(page, 'Escuro')

    // Sem o JavaScript do app, só o script inline do index.html pode aplicar o tema.
    await page.route('**/assets/*.js', (route) => route.abort())
    await page.reload()
    expect(await themeAttribute(page)).toBe('dark')
    expect(await bodyBackground(page)).toBe(DARK.bg)
    await expect(page.getByTestId('chart')).toHaveCount(0)
  })

  test('indicadores e desenhos continuam visíveis após trocar o tema', async ({ page }) => {
    await mockBinance(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()

    await page.getByRole('button', { name: /Indicadores/ }).click()
    await page.getByRole('menuitem', { name: /Força Relativa/ }).click()
    await page.getByRole('button', { name: 'Linha horizontal' }).click()
    const box = (await page.getByTestId('chart').boundingBox())!
    const y = box.y + box.height * 0.3
    await page.mouse.click(box.x + box.width * 0.5, y)
    await page.mouse.move(1, 1)

    await chooseTheme(page, 'Escuro')
    await page.mouse.move(1, 1)
    await expect.poll(() => hasColorNear(page, box.x + 40, y, '#e8833a', 3)).toBe(true)
    await expect(page.getByTestId('pane-legend').filter({ hasText: 'IFR 14' })).toBeVisible()
    await expect.poll(() => chartBackgroundIs(page, DARK.surface)).toBe(true)
  })
})
