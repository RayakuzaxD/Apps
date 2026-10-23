import { devices, expect, test, type Page } from '@playwright/test'
import { makeRestKlines } from '../fixtures/klines'
import { fixtureKlines, mockBinance } from './mockBinance'

const DAY_MS = 86_400_000
const FORBIDDEN = /\b(compre|comprar|compra|venda|vender|vende)\b/i

async function addIndicator(page: Page, name: RegExp) {
  await page.getByRole('button', { name: /Indicadores/ }).click()
  await page.getByRole('menuitem', { name }).click()
}

test.describe('Etapa 1a: base de ciclo', () => {
  test('1S e 1M usam os intervalos semanal e mensal da Binance', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()

    await page.getByRole('button', { name: '1S', exact: true }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('1S · Binance')
    await page.getByRole('button', { name: '1M', exact: true }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('1M · Binance')
    await expect(page.getByRole('button', { name: '1M', exact: true })).toHaveAttribute(
      'title',
      '1 mês',
    )

    expect(binance.klineRequests.map((r) => r.interval)).toEqual(['1h', '1w', '1M'])
    await expect
      .poll(() =>
        binance.wsMessages.filter((m) => m.method === 'SUBSCRIBE').flatMap((m) => m.params),
      )
      .toEqual(expect.arrayContaining(['btcusdt@kline_1w', 'btcusdt@kline_1M']))
  })

  test('BTC semanal completa o histórico com a Bitstamp antes da Binance', async ({ page }) => {
    const firstWeekMs = Number(fixtureKlines('BTCUSDT', '1w')[0]![0])
    const bitstampDaily = makeRestKlines(120, {
      startMs: firstWeekMs - 120 * DAY_MS,
      intervalMs: DAY_MS,
      startPrice: 7,
    })
    const binance = await mockBinance(page, { bitstampDaily })
    await page.goto('/')
    await page.getByRole('button', { name: '1S', exact: true }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('1S')

    // Pede à Bitstamp tudo antes do primeiro candle semanal da Binance, de uma vez.
    await expect.poll(() => binance.bitstampRequests).toEqual([firstWeekMs / 1000 - 1])
    // ETH não tem histórico extra.
    await page.getByRole('button', { name: /BTC\/USDT/ }).click()
    await page.getByRole('option', { name: /ETH\/USDT/ }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('ETH/USDT')
    expect(binance.bitstampRequests).toHaveLength(1)
  })

  test('escala log ligada por padrão no BTC, desligada no ETH, e lembrada por par', async ({
    page,
  }) => {
    await mockBinance(page)
    await page.goto('/')
    const log = page.getByTestId('log-scale')
    await expect(log).toHaveAttribute('aria-pressed', 'true')

    await log.click()
    await expect(log).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()
    await expect(log).toHaveAttribute('aria-pressed', 'false')

    await page.getByRole('button', { name: /BTC\/USDT/ }).click()
    await page.getByRole('option', { name: /ETH\/USDT/ }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('ETH/USDT')
    await expect(log).toHaveAttribute('aria-pressed', 'false')
  })

  test('menu por pacote e explicação ao tocar no nome do indicador', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await page.getByRole('button', { name: /Indicadores/ }).click()
    await expect(page.getByRole('group', { name: 'Ciclo & On-chain' })).toContainText(
      'Índice de Força Relativa',
    )
    await page.getByRole('menuitem', { name: /Força Relativa/ }).click()

    await page.getByRole('button', { name: 'IFR 14', exact: true }).click()
    const info = page.getByRole('dialog', { name: 'Índice de Força Relativa' })
    await expect(info).toContainText('O que é:')
    await expect(info).toContainText('Como ler: Acima de 70')
    await page.keyboard.press('Escape')
    await expect(info).toHaveCount(0)
  })

  test('Leitura do dia: valor e zona de cada indicador ligado, sem recomendação', async ({
    page,
  }) => {
    await mockBinance(page)
    await page.goto('/')
    await addIndicator(page, /Força Relativa/)
    await addIndicator(page, /Bollinger/)

    const reading = page.getByRole('region', { name: 'Leitura do dia' })
    await expect(reading).toBeVisible()
    await expect(reading.getByTestId('reading-period')).toContainText('Vela')
    await expect(reading.getByTestId('reading-rsi')).toContainText('IFR 14')
    await expect(reading.getByTestId('reading-rsi')).toContainText(/topo|meio|fundo/)
    await expect(reading.getByTestId('reading-bb')).toContainText('largura')
    expect(await reading.innerText()).not.toMatch(FORBIDDEN)

    // Ocultar o indicador tira ele da leitura.
    await page.getByRole('button', { name: 'Ocultar IFR 14' }).click()
    await expect(reading.getByTestId('reading-rsi')).toHaveCount(0)

    await page.getByRole('tab', { name: 'Watchlist' }).click()
    await expect(page.getByRole('region', { name: 'Watchlist' })).toBeVisible()
    expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN)
  })
})

// Medidas e toque do iPhone 13, mas no Chromium (o único navegador dos testes).
const { defaultBrowserType: _webkit, ...iPhone } = devices['iPhone 13']

test.describe('Etapa 1a: celular', () => {
  test.use(iPhone)

  test('cabeçalho em duas linhas, sem rolagem lateral, e painel fechado até tocar', async ({
    page,
  }) => {
    await mockBinance(page)
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    // Tempos gráficos e o botão de indicadores cabem na segunda linha.
    const header = await page.locator('header').boundingBox()
    expect(header!.height).toBeLessThan(110)
    await expect(page.getByRole('button', { name: '1M', exact: true })).toBeInViewport()

    await expect(page.getByRole('region', { name: 'Leitura do dia' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Mostrar painel' }).click()
    await expect(page.getByRole('region', { name: 'Leitura do dia' })).toBeVisible()
    await page.getByRole('button', { name: 'Fechar painel' }).click()
    await expect(page.getByRole('region', { name: 'Leitura do dia' })).toHaveCount(0)
  })
})
