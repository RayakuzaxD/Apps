import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ChartLegend } from './ChartLegend'

it('mostra OHLC, variação e volume do candle', () => {
  render(
    <ChartLegend
      symbol="BTCUSDT"
      interval="4h"
      candle={{ time: 0, open: 100, high: 120, low: 95, close: 110, volume: 1500 }}
    />,
  )
  expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
  expect(screen.getByText('4h · Binance')).toBeInTheDocument()
  expect(screen.getByTestId('legend-A')).toHaveTextContent('100,00')
  expect(screen.getByTestId('legend-M')).toHaveTextContent('120,00')
  expect(screen.getByTestId('legend-m')).toHaveTextContent('95,00')
  expect(screen.getByTestId('legend-F')).toHaveTextContent('110,00')
  expect(screen.getByTestId('legend-change')).toHaveTextContent('+10,00%')
  expect(screen.getByTestId('legend-change')).toHaveAttribute('data-dir', 'up')
})

it('sem candle mostra só o título', () => {
  render(<ChartLegend symbol="ETHUSDT" interval="1d" candle={null} />)
  expect(screen.getByText('ETH/USDT')).toBeInTheDocument()
  expect(screen.getByText('1D · Binance')).toBeInTheDocument()
  expect(screen.queryByTestId('legend-change')).not.toBeInTheDocument()
})
