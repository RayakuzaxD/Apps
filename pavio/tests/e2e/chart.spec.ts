import { expect, test } from '@playwright/test'
import { makeKlineEvent } from '../fixtures/klines'
import { KLINE_COUNT, fixtureKlines, mockBinance } from './mockBinance'

const ptBR = (v: number, digits = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

test.describe('Etapa 1: gráfico de candles', () => {
  test('carrega BTC/USDT 1h com histórico e marca de atribuição', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')

    const legend = page.getByTestId('chart-legend')
    await expect(legend).toContainText('BTC/USDT')
    await expect(legend).toContainText('1h · Binance')

    const last = fixtureKlines('BTCUSDT', '1h')[KLINE_COUNT - 1]!
    await expect(page.getByTestId('legend-F')).toHaveText(ptBR(Number(last[4])))
    await expect(page.getByTestId('chart').locator('canvas').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /TradingView Lightweight Charts™/ })).toBeVisible()
    await expect(page.getByTestId('connection-status')).toHaveText('Ao vivo')

    expect(binance.klineRequests).toEqual([{ symbol: 'BTCUSDT', interval: '1h' }])
    // A assinatura vai em lote junto com os streams da watchlist.
    await expect
      .poll(() =>
        binance.wsMessages.filter((m) => m.method === 'SUBSCRIBE').flatMap((m) => m.params),
      )
      .toContain('btcusdt@kline_1h')
  })

  test('atualiza o último candle em tempo real', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    await expect.poll(() => binance.wsMessages.length).toBeGreaterThan(0)

    const last = fixtureKlines('BTCUSDT', '1h')[KLINE_COUNT - 1]!
    const time = Number(last[0]) / 1000
    binance.sendKline(
      'btcusdt@kline_1h',
      makeKlineEvent('BTCUSDT', '1h', {
        time,
        open: Number(last[1]),
        high: 99_999,
        low: Number(last[3]),
        close: 99_999,
        volume: 1234,
      }),
    )
    await expect(page.getByTestId('legend-F')).toHaveText(ptBR(99_999))

    // Candle seguinte é anexado.
    binance.sendKline(
      'btcusdt@kline_1h',
      makeKlineEvent('BTCUSDT', '1h', {
        time: time + 3600,
        open: 99_999,
        high: 100_500,
        low: 99_000,
        close: 100_100,
        volume: 10,
      }),
    )
    await expect(page.getByTestId('legend-F')).toHaveText(ptBR(100_100))
    await expect(page.getByTestId('legend-A')).toHaveText(ptBR(99_999))
  })

  test('legenda acompanha o candle sob o crosshair', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    const close = page.getByTestId('legend-F')
    const lastClose = ptBR(Number(fixtureKlines('BTCUSDT', '1h')[KLINE_COUNT - 1]![4]))
    await expect(close).toHaveText(lastClose)

    const box = (await page.getByTestId('chart').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2)
    await expect(close).not.toHaveText(lastClose)

    await page.mouse.move(0, 0)
    await expect(close).toHaveText(lastClose)
  })

  test('troca de par pelo seletor e reinscreve o stream', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    await expect(page.getByTestId('connection-status')).toHaveText('Ao vivo')

    await page.getByRole('button', { name: /Trocar par/ }).click()
    await page.getByRole('combobox', { name: 'Buscar par' }).fill('eth')
    await page.getByRole('option', { name: /ETH\/USDT/ }).click()
    // Tira o mouse de cima do gráfico: com o crosshair ativo a legenda mostra o candle sob o cursor.
    await page.mouse.move(0, 0)

    await expect(page.getByTestId('chart-legend')).toContainText('ETH/USDT')
    const last = fixtureKlines('ETHUSDT', '1h')[KLINE_COUNT - 1]!
    await expect(page.getByTestId('legend-F')).toHaveText(ptBR(Number(last[4])))
    expect(binance.klineRequests.at(-1)).toEqual({ symbol: 'ETHUSDT', interval: '1h' })
    await expect
      .poll(() => binance.wsMessages.slice(-2))
      .toEqual([
        { method: 'UNSUBSCRIBE', params: ['btcusdt@kline_1h'] },
        { method: 'SUBSCRIBE', params: ['ethusdt@kline_1h'] },
      ])
  })

  test('troca de timeframe e mantém a escolha após recarregar', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    await page.getByRole('button', { name: '1D', exact: true }).click()

    await expect(page.getByTestId('chart-legend')).toContainText('1D · Binance')
    await expect(page.getByRole('button', { name: '1D', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(binance.klineRequests.at(-1)).toEqual({ symbol: 'BTCUSDT', interval: '1d' })

    for (const tf of ['1m', '5m', '15m', '4h']) {
      await page.getByRole('button', { name: tf, exact: true }).click()
      await expect(page.getByTestId('chart-legend')).toContainText(`${tf} · Binance`)
    }

    await page.reload()
    await expect(page.getByTestId('chart-legend')).toContainText('4h · Binance')
  })

  test('mostra erro para par inexistente e permite trocar', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await page.getByRole('button', { name: /Trocar par/ }).click()
    await page.getByRole('combobox', { name: 'Buscar par' }).fill('NOPEUSDT')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('alert')).toContainText('O par NOPEUSDT não existe na Binance.')
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()

    await page.getByRole('button', { name: /Trocar par/ }).click()
    await page.getByRole('option', { name: /SOL\/USDT/ }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByTestId('chart-legend')).toContainText('SOL/USDT')
  })
})
