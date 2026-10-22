import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer } from './Footer'

describe('Footer', () => {
  it('exibe a atribuição do Lightweight Charts com link para tradingview.com', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: /TradingView Lightweight Charts™/ })
    expect(link).toHaveAttribute('href', 'https://www.tradingview.com/')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
