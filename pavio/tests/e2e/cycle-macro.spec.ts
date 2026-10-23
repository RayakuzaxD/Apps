import { expect, test, type Page } from '@playwright/test'
import { mockBinance } from './mockBinance'

const FORBIDDEN = /\b(compre|comprar|compra|venda|vender|vende)\b/i

async function addIndicator(page: Page, name: RegExp) {
  await page.getByRole('button', { name: /Indicadores/ }).click()
  await page.getByRole('menuitem', { name }).click()
}

const reading = (page: Page) => page.getByRole('region', { name: 'Leitura do dia' })

test.describe('Etapa 1b: ciclo e macro', () => {
  test('Faixa de Bull e média de 200 semanas no 1h buscam velas semanais e mensais', async ({
    page,
  }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    await expect(page.getByTestId('legend-F')).not.toBeEmpty()
    await addIndicator(page, /Faixa de Bull/)
    await addIndicator(page, /Média de 200 semanas/)

    await expect(
      page.getByRole('button', { name: 'Faixa Bull 20s/21s', exact: true }),
    ).toBeVisible()
    await expect
      .poll(() => binance.klineRequests.map((r) => `${r.interval}${r.limit ? `:${r.limit}` : ''}`))
      .toEqual(expect.arrayContaining(['1h', '1w', '1M:24']))
    // Semanal baixado uma vez para os dois indicadores.
    expect(binance.klineRequests.filter((r) => r.interval === '1w')).toHaveLength(1)

    const bull = reading(page).getByTestId('reading-bmsb')
    await expect(bull).toContainText(/(acima|abaixo|dentro) da faixa/)
    await expect(bull).toContainText('A última semana fechada')
    // 300 semanas no mock: a média de 200 semanas tem valor.
    await expect(reading(page).getByTestId('reading-sma200w')).toContainText(/acima|abaixo/)
  })

  test('no 1S usa as próprias velas, sem baixar o semanal de novo', async ({ page }) => {
    const binance = await mockBinance(page)
    await page.goto('/')
    await page.getByRole('button', { name: '1S', exact: true }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('1S')
    await addIndicator(page, /Faixa de Bull/)
    await expect(reading(page).getByTestId('reading-bmsb')).toContainText('da faixa')
    expect(binance.klineRequests.filter((r) => r.interval === '1w')).toHaveLength(1)
  })

  test('MVRV, Preço Realizado, GLI e NFCI com os dados do robô', async ({ page }) => {
    const binance = await mockBinance(page, { externalData: 'all' })
    await page.goto('/')
    await addIndicator(page, /^MVRV/)
    await addIndicator(page, /Preço Realizado/)
    await addIndicator(page, /Liquidez Global/)
    await addIndicator(page, /Condições Financeiras/)

    await expect(reading(page).getByTestId('reading-mvrv')).toContainText(
      /fundo|acumulação|meio|topo/,
    )
    await expect(reading(page).getByTestId('reading-mvrv')).toContainText('Coin Metrics')
    await expect(reading(page).getByTestId('reading-realized')).toContainText(
      'do Preço Realizado (MVRV = 1)',
    )
    await expect(reading(page).getByTestId('reading-gli')).toContainText(/US\$ [\d,]+ tri/)
    await expect(reading(page).getByTestId('reading-gli')).toContainText(/subindo|caindo|estável/)
    await expect(reading(page).getByTestId('reading-nfci')).toContainText(
      /afrouxando|apertando|estável/,
    )
    expect([...new Set(binance.dataRequests)].sort()).toEqual([
      'BTC_MVRV',
      'BTC_PRICE_CM',
      'DEXJPUS',
      'DEXUSEU',
      'ECBASSETSW',
      'JPNASSETS',
      'NFCI',
      'RRPONTSYD',
      'WALCL',
      'WTREGEN',
    ])
    expect(await reading(page).innerText()).not.toMatch(FORBIDDEN)

    // Offset do GLI: rótulo e leitura mostram o deslocamento.
    await page.getByRole('button', { name: 'Configurar GLI' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Offset (dias à frente)').fill('30')
    await dialog.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('button', { name: 'GLI +30d', exact: true })).toBeVisible()
    await expect(reading(page).getByTestId('reading-gli')).toContainText('Deslocado 30 dias')
  })

  test('sem os arquivos do robô, ou fora do BTC, mostra "sem dado"', async ({ page }) => {
    await mockBinance(page)
    await page.goto('/')
    await addIndicator(page, /^MVRV/)
    await addIndicator(page, /Liquidez Global/)
    await expect(reading(page).getByTestId('reading-mvrv')).toContainText('sem dado')
    await expect(reading(page).getByTestId('reading-gli')).toContainText('sem dado')
  })

  test('MVRV é só do BTC', async ({ page }) => {
    await mockBinance(page, { externalData: 'all' })
    await page.goto('/')
    await addIndicator(page, /^MVRV/)
    await expect(reading(page).getByTestId('reading-mvrv')).not.toContainText('sem dado')
    await page.getByRole('button', { name: /BTC\/USDT/ }).click()
    await page.getByRole('option', { name: /ETH\/USDT/ }).click()
    await expect(page.getByTestId('chart-legend')).toContainText('ETH/USDT')
    await expect(reading(page).getByTestId('reading-mvrv')).toContainText('sem dado')
  })

  test('explicação dos indicadores novos ao tocar no nome', async ({ page }) => {
    await mockBinance(page, { externalData: 'all' })
    await page.goto('/')
    await addIndicator(page, /Condições Financeiras/)
    await page.getByRole('button', { name: 'NFCI', exact: true }).click()
    const info = page.getByRole('dialog', { name: 'Condições Financeiras (NFCI)' })
    await expect(info).toContainText('O que importa é a direção')
  })
})
