import { expect, test } from '@playwright/test'
import { mockBinance } from './mockBinance'

test('carrega a casca do app com marca e atribuição', async ({ page }) => {
  await mockBinance(page)
  await page.goto('/')
  await expect(page).toHaveTitle('Pavio')
  await expect(page.getByText('Pavio', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /TradingView Lightweight Charts™/ })).toHaveAttribute(
    'href',
    'https://www.tradingview.com/',
  )
})
