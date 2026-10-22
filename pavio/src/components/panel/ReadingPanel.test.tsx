import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  computeIndicator,
  defaultParams,
  type IndicatorConfig,
} from '../../domain/indicators/registry'
import type { Candle } from '../../domain/types'
import { ReadingPanel } from './ReadingPanel'
import { periodPhrases } from './periodPhrases'

const WEEK = 7 * 86_400
const START = Date.UTC(2024, 0, 1) / 1000 // segunda-feira

const candles: Candle[] = Array.from({ length: 60 }, (_, i) => {
  const close = 100 + i // alta constante: IFR no topo
  return {
    time: START + i * WEEK,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: 5,
  }
})
const lastTime = candles.at(-1)!.time

const cfg = (type: IndicatorConfig['type'], visible = true): IndicatorConfig => ({
  id: type,
  type,
  params: defaultParams(type),
  visible,
})

function renderPanel(configs: IndicatorConfig[], now: number, data = candles) {
  const results = configs.map((c) => computeIndicator(c, data))
  return render(
    <ReadingPanel
      symbol="BTCUSDT"
      interval="1w"
      candles={data}
      results={results}
      status="ready"
      now={now}
    />,
  )
}

describe('ReadingPanel', () => {
  it('mostra preço e a leitura de cada indicador ligado, com a semana em formação', () => {
    renderPanel([cfg('rsi'), cfg('sma'), cfg('macd', false)], lastTime + 3 * 86_400)
    expect(screen.getByTestId('reading-period')).toHaveTextContent(
      'Semana em formação · 17/02/2025',
    )
    expect(screen.getByTestId('reading-price')).toHaveTextContent('159,00')
    expect(screen.getByTestId('reading-price')).toHaveTextContent(
      'Variação desde a abertura da semana.',
    )
    const rsi = screen.getByTestId('reading-rsi')
    expect(within(rsi).getByText('IFR 14')).toBeInTheDocument()
    expect(within(rsi).getByText('topo')).toHaveAttribute('data-tone', 'top')
    expect(screen.getByTestId('reading-sma')).toHaveTextContent('acima')
    // Indicador oculto não entra na leitura.
    expect(screen.queryByTestId('reading-macd')).not.toBeInTheDocument()
  })

  it('semana já fechada e "sem dado" quando o indicador não tem histórico suficiente', () => {
    const few = candles.slice(0, 5)
    renderPanel([cfg('sma')], few.at(-1)!.time + 2 * WEEK, few)
    expect(screen.getByTestId('reading-period')).toHaveTextContent('Semana fechada')
    expect(screen.getByTestId('reading-sma')).toHaveTextContent('sem dado')
    expect(screen.getByText(/Valores e zonas da última semana fechada/)).toBeInTheDocument()
  })

  it('sem indicadores ligados, orienta a adicionar', () => {
    renderPanel([], lastTime)
    expect(screen.getByText(/Nenhum indicador ligado/)).toBeInTheDocument()
  })

  it('carregando e erro', () => {
    const { rerender } = render(
      <ReadingPanel symbol="BTCUSDT" interval="1d" candles={[]} results={[]} status="loading" />,
    )
    expect(screen.getByText('Carregando dados…')).toBeInTheDocument()
    rerender(
      <ReadingPanel symbol="BTCUSDT" interval="1d" candles={[]} results={[]} status="error" />,
    )
    expect(screen.getByText('Sem dado.')).toBeInTheDocument()
  })

  it('não usa palavras de recomendação', () => {
    const { container } = renderPanel([cfg('rsi'), cfg('bb'), cfg('ema'), cfg('macd')], lastTime)
    expect(container.textContent).not.toMatch(/\b(compre|comprar|compra|venda|vender|vende)\b/i)
  })
})

it('mês em formação até o último instante do mês (31 dias)', () => {
  const oct = Date.UTC(2026, 9, 1) / 1000
  const monthly: Candle[] = [{ time: oct, open: 1, high: 2, low: 1, close: 2, volume: 1 }]
  const lastHour = Date.UTC(2026, 9, 31, 23) / 1000
  render(
    <ReadingPanel
      symbol="BTCUSDT"
      interval="1M"
      candles={monthly}
      results={[]}
      status="ready"
      now={lastHour}
    />,
  )
  expect(screen.getByTestId('reading-period')).toHaveTextContent(
    'Mês em formação · outubro de 2026',
  )
})

describe('periodPhrases', () => {
  it.each([
    ['1d', true, 'Dia em formação', 'Variação desde a abertura do dia.', 'do dia em formação'],
    [
      '1w',
      false,
      'Semana fechada',
      'Variação desde a abertura da semana.',
      'da última semana fechada',
    ],
    ['1M', false, 'Mês fechado', 'Variação desde a abertura do mês.', 'do último mês fechado'],
    ['4h', true, 'Vela em formação', 'Variação desde a abertura da vela.', 'da vela em formação'],
  ] as const)('%s (em formação: %s)', (interval, forming, status, sinceOpen, scope) => {
    expect(periodPhrases(interval, forming)).toEqual({ status, sinceOpen, scope })
  })
})
