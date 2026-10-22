import { expect, test, type Page } from '@playwright/test'
import { makeMiniTicker } from '../fixtures/tickers'
import { TICKERS, mockBinance } from './mockBinance'

const row = (page: Page, symbol: string) => page.getByTestId(`watch-${symbol}`)

test.describe('Etapa 5: watchlist', () => {
  test('lista padrão com preço e variação de 24h do snapshot', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    const watchlist = page.getByRole('complementary', { name: 'Watchlist' })
    await expect(watchlist).toBeVisible()
    await expect(watchlist).toContainText('6 pares')

    await expect(row(page, 'BTCUSDT').getByTestId('watch-price')).toHaveText('61.234,50')
    await expect(row(page, 'BTCUSDT').getByTestId('watch-change')).toHaveText('+2,06%')
    await expect(row(page, 'ETHUSDT').getByTestId('watch-change')).toHaveText('-2,00%')
    await expect(row(page, 'DOGEUSDT').getByTestId('watch-price')).toHaveText('0,12345')
    await expect(row(page, 'SOLUSDT').getByTestId('watch-change')).toHaveText('0,00%')
    await expect(row(page, 'BTCUSDT')).toHaveAttribute('aria-current', 'true')

    expect([...binance.tickerRequests].sort()).toEqual(
      Object.keys(TICKERS)
        .filter((s) => s !== 'LINKUSDT')
        .sort(),
    )
    await expect
      .poll(() => binance.wsMessages.flatMap((m) => m.params))
      .toEqual(expect.arrayContaining(['btcusdt@miniTicker', 'dogeusdt@miniTicker']))
  })

  test('atualiza preço, variação e cor em tempo real', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    const eth = row(page, 'ETHUSDT')
    await expect(eth.getByTestId('watch-change')).toHaveText('-2,00%')
    await expect.poll(() => binance.wsMessages.length).toBeGreaterThan(0)

    binance.send('ethusdt@miniTicker', makeMiniTicker('ETHUSDT', 3150, 3000))
    await expect(eth.getByTestId('watch-price')).toHaveText('3.150,00')
    await expect(eth.getByTestId('watch-change')).toHaveText('+5,00%')
    await expect(eth.getByTestId('watch-change')).toHaveAttribute('data-sign', 'up')
    await expect(eth.getByTestId('watch-price')).toHaveAttribute('data-flash', 'up')

    binance.send('ethusdt@miniTicker', makeMiniTicker('ETHUSDT', 2700, 3000))
    await expect(eth.getByTestId('watch-change')).toHaveText('-10,00%')
    await expect(eth.getByTestId('watch-price')).toHaveAttribute('data-flash', 'down')
  })

  test('clicar num par abre no gráfico', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Abrir ETH/USDT no gráfico' }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('ETH/USDT')
    await expect(row(page, 'ETHUSDT')).toHaveAttribute('aria-current', 'true')
    await expect(row(page, 'BTCUSDT')).not.toHaveAttribute('aria-current')
  })

  test('adiciona, valida, remove e persiste após recarregar', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    const input = page.getByRole('textbox', { name: 'Adicionar par à watchlist' })

    await input.fill('nopeusdt')
    await input.press('Enter')
    await expect(page.getByRole('alert')).toHaveText('NOPEUSDT não existe na Binance.')

    await input.fill('eth/usdt')
    await input.press('Enter')
    await expect(page.getByRole('alert')).toHaveText('ETHUSDT já está na watchlist.')

    await input.fill('link/usdt')
    await input.press('Enter')
    await expect(input).toHaveValue('')
    await expect(row(page, 'LINKUSDT').getByTestId('watch-price')).toHaveText('14,567')
    await expect(row(page, 'LINKUSDT').getByTestId('watch-change')).toHaveText('+4,05%')
    await expect
      .poll(() => binance.wsMessages)
      .toContainEqual({ method: 'SUBSCRIBE', params: ['linkusdt@miniTicker'] })

    await row(page, 'DOGEUSDT').hover()
    await page.getByRole('button', { name: 'Remover DOGE/USDT da watchlist' }).click()
    await expect(row(page, 'DOGEUSDT')).toHaveCount(0)
    await expect
      .poll(() => binance.wsMessages)
      .toContainEqual({ method: 'UNSUBSCRIBE', params: ['dogeusdt@miniTicker'] })

    await page.reload()
    await expect(row(page, 'LINKUSDT')).toBeVisible()
    await expect(row(page, 'DOGEUSDT')).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: 'Watchlist' })).toContainText('6 pares')
  })

  test('pode ser ocultada e reaberta (e lembra a escolha)', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Ocultar watchlist' }).click()
    await expect(page.getByRole('complementary', { name: 'Watchlist' })).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()
    await expect(page.getByRole('complementary', { name: 'Watchlist' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Mostrar watchlist' }).click()
    await expect(row(page, 'BTCUSDT').getByTestId('watch-price')).toHaveText('61.234,50')
  })
})
