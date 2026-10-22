import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IndicatorMenu } from './IndicatorMenu'

describe('IndicatorMenu', () => {
  it('lista os 5 indicadores e adiciona o escolhido', async () => {
    const onAdd = vi.fn()
    render(<IndicatorMenu count={0} max={12} onAdd={onAdd} />)
    await userEvent.click(screen.getByRole('button', { name: /Indicadores/ }))
    expect(
      screen.getAllByRole('menuitem').map((i) => i.querySelector('span')?.textContent),
    ).toEqual([
      'Média Móvel Exponencial (MME)',
      'Média Móvel Simples (MMS)',
      'Bandas de Bollinger (BB)',
      'Índice de Força Relativa (IFR)',
      'MACD (MACD)',
    ])
    await userEvent.click(screen.getByRole('menuitem', { name: /Força Relativa/ }))
    expect(onAdd).toHaveBeenCalledWith('rsi')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('mostra a contagem e bloqueia no limite', async () => {
    render(<IndicatorMenu count={12} max={12} onAdd={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Indicadores/ })).toHaveTextContent('12')
    await userEvent.click(screen.getByRole('button', { name: /Indicadores/ }))
    for (const item of screen.getAllByRole('menuitem')) expect(item).toBeDisabled()
    expect(screen.getByText('Limite de 12 indicadores atingido.')).toBeInTheDocument()
  })

  it('fecha com Escape', async () => {
    render(<IndicatorMenu count={0} max={12} onAdd={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Indicadores/ }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
