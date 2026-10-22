import { expect, test } from '@playwright/test'
import { makeKlineEvent } from '../fixtures/klines'
import { countPanePixels } from './canvas'
import { KLINE_COUNT, fixtureKlines, mockBinance } from './mockBinance'

test.describe('Etapa 2: volume', () => {
  test('desenha barras de volume verdes e vermelhas na faixa inferior', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()

    // Faixa inferior: só o volume ocupa (os candles têm margem inferior de 25%).
    await expect
      .poll(async () => {
        const strip = await countPanePixels(page, 0.88, 0.99)
        return strip.green > 50 && strip.red > 50
      })
      .toBe(true)
  })

  test('legenda mostra o volume do candle e acompanha o tempo real', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    const last = fixtureKlines('BTCUSDT', '1h')[KLINE_COUNT - 1]!
    const legend = page.getByTestId('chart-legend')
    await expect(legend).toContainText('Vol')
    await expect.poll(() => binance.wsMessages.length).toBeGreaterThan(0)

    binance.sendKline(
      'btcusdt@kline_1h',
      makeKlineEvent('BTCUSDT', '1h', {
        time: Number(last[0]) / 1000,
        open: Number(last[1]),
        high: Number(last[2]),
        low: Number(last[3]),
        close: Number(last[4]),
        volume: 2_500_000,
      }),
    )
    await expect(page.getByTestId('legend-volume')).toHaveText(/2,5\smi/)
  })
})
