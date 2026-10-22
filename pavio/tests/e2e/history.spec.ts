import { expect, test, type Page } from '@playwright/test'
import { deepKlines, mockBinance } from './mockBinance'

const TOTAL = 2500

/** Arrasta o gráfico na horizontal: `older` mostra candles mais antigos. */
async function pan(page: Page, direction: 'older' | 'newer') {
  const box = (await page.getByTestId('chart').boundingBox())!
  const y = box.y + box.height * 0.4
  const [from, to] = [box.x + 60, box.x + box.width - 120]
  await page.mouse.move(direction === 'older' ? from : to, y)
  await page.mouse.down()
  await page.mouse.move(direction === 'older' ? to : from, y, { steps: 8 })
  await page.mouse.up()
}

const panLeft = (page: Page) => pan(page, 'older')

const legendText = (page: Page) =>
  Promise.all(['A', 'M', 'm', 'F'].map((l) => page.getByTestId(`legend-${l}`).textContent()))

test.describe('Histórico ao rolar', () => {
  test('carrega candles anteriores ao rolar para a esquerda sem mover a visão', async ({
    page,
  }) => {
    const binance = await mockBinance(page, { historyTotal: TOTAL })
    // Segura a resposta do histórico anterior para comparar antes e depois.
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    let held = 0
    await page.route('**/api/v3/klines?**', async (route) => {
      if (new URL(route.request().url()).searchParams.has('endTime')) {
        held++
        await gate
      }
      await route.fallback()
    })

    await page.goto('/')
    const rows = deepKlines('BTCUSDT', '1h', TOTAL)
    const newest = rows.slice(-1000)
    await expect(page.getByTestId('legend-F')).toHaveText(
      Number(newest.at(-1)![4]).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    )
    await expect(page.getByTestId('older-status')).toHaveCount(0)

    for (let i = 0; i < 20 && held === 0; i++) await panLeft(page)
    await expect(page.getByTestId('older-status')).toHaveText('Carregando histórico…')

    const box = (await page.getByTestId('chart').boundingBox())!
    const hover = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.4 }
    await page.mouse.move(hover.x, hover.y)
    const before = await legendText(page)

    release()
    await expect(page.getByTestId('older-status')).toHaveCount(0)
    expect(held).toBe(1)
    expect(binance.klineRequests[1]).toEqual({
      symbol: 'BTCUSDT',
      interval: '1h',
      endTime: Number(newest[0]![0]) - 1,
    })

    // A legenda segue no mesmo candle (ancorada por horário)...
    expect(await legendText(page)).toEqual(before)
    // ...e o candle sob o cursor continua o mesmo: a visão não pulou.
    await page.mouse.move(hover.x + 1, hover.y)
    await page.mouse.move(hover.x, hover.y)
    expect(await legendText(page)).toEqual(before)
  })

  test('mostra o início do histórico quando a Binance não tem mais candles', async ({ page }) => {
    const binance = await mockBinance(page, { historyTotal: TOTAL })
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toHaveText('')

    const status = page.getByTestId('older-status')
    for (let i = 0; i < 80; i++) {
      if ((await status.allTextContents()).includes('Início do histórico')) break
      await panLeft(page)
    }
    await expect(status).toHaveText('Início do histórico')

    // O aviso só aparece com o primeiro candle na tela.
    await pan(page, 'newer')
    await expect(status).toHaveCount(0)
    await panLeft(page)
    await expect(status).toHaveText('Início do histórico')

    // 1000 iniciais + 1000 + 500: o último pedido veio incompleto.
    const rows = deepKlines('BTCUSDT', '1h', TOTAL)
    expect(binance.klineRequests.map((r) => r.endTime)).toEqual([
      undefined,
      Number(rows[1500]![0]) - 1,
      Number(rows[500]![0]) - 1,
    ])
  })

  test('falha ao carregar histórico anterior permite tentar de novo', async ({ page }) => {
    const binance = await mockBinance(page, { historyTotal: TOTAL })
    let fail = true
    await page.route('**/api/v3/klines?**', async (route) => {
      const older = new URL(route.request().url()).searchParams.has('endTime')
      if (older && fail) await route.abort('failed')
      else await route.fallback()
    })
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toHaveText('')

    const status = page.getByTestId('older-status')
    for (let i = 0; i < 20 && (await status.count()) === 0; i++) await panLeft(page)
    await expect(status).toContainText('Falha ao carregar histórico anterior')
    // O gráfico continua com os dados atuais.
    await expect(page.getByTestId('legend-F')).not.toHaveText('')

    fail = false
    await status.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(status).toHaveCount(0)
    await expect
      .poll(() => binance.klineRequests.filter((r) => r.endTime !== undefined).length)
      .toBe(1)
  })
})
