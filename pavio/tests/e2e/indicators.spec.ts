import { expect, test, type Page } from '@playwright/test'
import { ema, rsi } from '../../src/domain/indicators/math'
import { makeKlineEvent } from '../fixtures/klines'
import { KLINE_COUNT, fixtureKlines, mockBinance } from './mockBinance'

const ptBR = (v: number, digits = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

const closes = () => fixtureKlines('BTCUSDT', '1h').map((row) => Number(row[4]))

async function addIndicator(page: Page, name: RegExp) {
  await page.getByRole('button', { name: /Indicadores/ }).click()
  await page.getByRole('menuitem', { name }).click()
  await page.mouse.move(0, 0)
}

test.describe('Etapa 3: indicadores', () => {
  test('MME sobre os candles com o valor calculado', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()

    await addIndicator(page, /Média Móvel Exponencial/)
    const row = page.getByTestId('indicator-ema')
    await expect(row).toContainText('MME 21')
    const expected = ema(closes(), 21)[KLINE_COUNT - 1]!
    await expect(row.getByTestId('indicator-value-value')).toHaveText(ptBR(expected))
    await expect(page.getByRole('button', { name: /Indicadores/ })).toContainText('1')
  })

  test('IFR e MACD ganham painéis próprios abaixo do gráfico', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()
    const chart = (await page.getByTestId('chart').boundingBox())!

    await addIndicator(page, /Força Relativa/)
    await addIndicator(page, /MACD/)

    const rsiLegend = page.getByTestId('pane-legend').filter({ hasText: 'IFR 14' })
    const macdLegend = page.getByTestId('pane-legend').filter({ hasText: 'MACD 12 26 9' })
    await expect(rsiLegend).toBeVisible()
    await expect(macdLegend).toBeVisible()

    const expectedRsi = rsi(closes(), 14)[KLINE_COUNT - 1]!
    await expect(rsiLegend.getByTestId('indicator-value-value')).toHaveText(ptBR(expectedRsi))

    // Painel principal ocupa a parte de cima; IFR e MACD ficam abaixo, nessa ordem.
    const rsiBox = (await rsiLegend.boundingBox())!
    const macdBox = (await macdLegend.boundingBox())!
    expect(rsiBox.y).toBeGreaterThan(chart.y + chart.height * 0.45)
    expect(macdBox.y).toBeGreaterThan(rsiBox.y + 40)
    expect(macdBox.y).toBeLessThan(chart.y + chart.height)

    // A legenda acompanha o painel quando o de cima é removido.
    await rsiLegend.hover()
    await page.getByRole('button', { name: 'Remover IFR 14' }).click()
    await expect(rsiLegend).toHaveCount(0)
    await expect.poll(async () => (await macdLegend.boundingBox())!.y).toBeLessThan(macdBox.y - 20)
  })

  test('edita parâmetros pelo diálogo', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await addIndicator(page, /Média Móvel Exponencial/)
    const row = page.getByTestId('indicator-ema')
    await expect(row).toContainText('MME 21')

    await row.hover()
    await page.getByRole('button', { name: 'Configurar MME 21' }).click()
    const dialog = page.getByRole('dialog', { name: 'Média Móvel Exponencial' })
    await dialog.getByLabel('Período').fill('0')
    await expect(dialog.getByRole('alert')).toHaveText('Entre 1 e 500.')
    await expect(dialog.getByRole('button', { name: 'Aplicar' })).toBeDisabled()

    await dialog.getByLabel('Período').fill('9')
    await dialog.getByRole('button', { name: 'Aplicar' }).click()
    await expect(dialog).toHaveCount(0)
    // O botão ficava sobre o gráfico: tira o mouse para a legenda voltar ao último candle.
    await page.mouse.move(0, 0)

    await expect(row).toContainText('MME 9')
    const expected = ema(closes(), 9)[KLINE_COUNT - 1]!
    await expect(row.getByTestId('indicator-value-value')).toHaveText(ptBR(expected))
  })

  test('várias instâncias, ocultar, remover e persistir após recarregar', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await addIndicator(page, /Média Móvel Exponencial/)
    await addIndicator(page, /Média Móvel Exponencial/)
    await addIndicator(page, /Bandas de Bollinger/)
    await expect(page.getByTestId('indicator-ema')).toHaveCount(2)
    await expect(page.getByTestId('indicator-bb')).toContainText('BB 20 2')

    const bb = page.getByTestId('indicator-bb')
    await bb.hover()
    await page.getByRole('button', { name: 'Ocultar BB 20 2' }).click()
    await expect(bb).toHaveAttribute('data-hidden', 'true')

    await page.getByTestId('indicator-ema').first().hover()
    await page.getByRole('button', { name: 'Remover MME 21' }).first().click()
    await expect(page.getByTestId('indicator-ema')).toHaveCount(1)

    await page.reload()
    await expect(page.getByTestId('indicator-ema')).toHaveCount(1)
    await expect(page.getByTestId('indicator-bb')).toHaveAttribute('data-hidden', 'true')
  })

  test('valores dos indicadores acompanham o tempo real', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    await addIndicator(page, /Média Móvel Simples/)
    const value = page.getByTestId('indicator-sma').getByTestId('indicator-value-value')
    const before = await value.textContent()
    await expect.poll(() => binance.wsMessages.length).toBeGreaterThan(0)

    const last = fixtureKlines('BTCUSDT', '1h')[KLINE_COUNT - 1]!
    const time = Number(last[0]) / 1000
    binance.sendKline(
      'btcusdt@kline_1h',
      makeKlineEvent('BTCUSDT', '1h', {
        time: time + 3600,
        open: 80_000,
        high: 80_000,
        low: 80_000,
        close: 80_000,
        volume: 1,
      }),
    )
    const values = [...closes(), 80_000]
    const expected = values.slice(-50).reduce((a, b) => a + b, 0) / 50
    await expect(value).toHaveText(ptBR(expected))
    expect(ptBR(expected)).not.toBe(before)
  })
})
