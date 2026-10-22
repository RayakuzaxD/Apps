import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defaultParams, type IndicatorResult } from '../../domain/indicators/registry'
import { IndicatorLegendRow } from './IndicatorLegendRow'

const macd: IndicatorResult = {
  config: { id: 'm', type: 'macd', params: defaultParams('macd'), visible: true },
  outputs: {
    histogram: [null, -0.5, 1.25],
    macd: [null, 10, 12.5],
    signal: [null, 10.5, 11.25],
  },
}

function setup(result: IndicatorResult, index: number | null) {
  const handlers = { onToggle: vi.fn(), onEdit: vi.fn(), onRemove: vi.fn() }
  render(<IndicatorLegendRow result={result} index={index} precision={2} {...handlers} />)
  return handlers
}

describe('IndicatorLegendRow', () => {
  it('mostra rótulo e valores do índice', () => {
    setup(macd, 2)
    expect(screen.getByText('MACD 12 26 9')).toBeInTheDocument()
    expect(screen.getByTestId('indicator-value-histogram')).toHaveTextContent('1,25')
    expect(screen.getByTestId('indicator-value-histogram')).toHaveStyle({ color: 'var(--up)' })
    expect(screen.getByTestId('indicator-value-macd')).toHaveTextContent('12,50')
    expect(screen.getByTestId('indicator-value-signal')).toHaveTextContent('11,25')
  })

  it('histograma negativo usa a cor de baixa', () => {
    setup(macd, 1)
    expect(screen.getByTestId('indicator-value-histogram')).toHaveStyle({ color: 'var(--down)' })
  })

  it('posição sem valor mostra traço', () => {
    setup(macd, 0)
    expect(screen.getByTestId('indicator-value-macd')).toHaveTextContent('–')
  })

  it('IFR usa 2 casas independentemente do preço', () => {
    const rsi: IndicatorResult = {
      config: { id: 'r', type: 'rsi', params: defaultParams('rsi'), visible: true },
      outputs: { value: [65.4321] },
    }
    render(
      <IndicatorLegendRow
        result={rsi}
        index={0}
        precision={6}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByTestId('indicator-value-value')).toHaveTextContent('65,43')
  })

  it('botões de ocultar, configurar e remover', async () => {
    const handlers = setup(macd, 2)
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar MACD 12 26 9' }))
    await userEvent.click(screen.getByRole('button', { name: 'Configurar MACD 12 26 9' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover MACD 12 26 9' }))
    expect(handlers.onToggle).toHaveBeenCalledWith('m')
    expect(handlers.onEdit).toHaveBeenCalledWith('m')
    expect(handlers.onRemove).toHaveBeenCalledWith('m')
  })

  it('tocar no nome abre o que é e como ler; Esc fecha', async () => {
    setup(macd, 2)
    await userEvent.click(screen.getByRole('button', { name: 'MACD 12 26 9' }))
    const info = screen.getByRole('dialog', { name: 'MACD' })
    expect(info).toHaveTextContent('O que é: Diferença entre duas médias exponenciais')
    expect(info).toHaveTextContent('Como ler: MACD acima da linha de sinal')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('indicador oculto oferece mostrar', () => {
    setup({ ...macd, config: { ...macd.config, visible: false } }, 2)
    expect(screen.getByRole('button', { name: 'Mostrar MACD 12 26 9' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
