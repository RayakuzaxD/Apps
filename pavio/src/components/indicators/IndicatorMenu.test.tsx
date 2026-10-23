import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IndicatorMenu } from './IndicatorMenu'

describe('IndicatorMenu', () => {
  it('agrupa os indicadores por pacote e adiciona o escolhido', async () => {
    const onAdd = vi.fn()
    render(<IndicatorMenu count={0} max={12} onAdd={onAdd} />)
    await userEvent.click(screen.getByRole('button', { name: /Indicadores/ }))
    const names = (group: string) =>
      within(screen.getByRole('group', { name: group }))
        .getAllByRole('menuitem')
        .map((i) => i.querySelector('span')?.textContent)
    expect(names('Ciclo & On-chain')).toEqual([
      'Bandas de Bollinger (BB)',
      'Índice de Força Relativa (IFR)',
      'Faixa de Bull Market (Faixa Bull)',
      'Média de 50 semanas (MMS)',
      'Média de 200 semanas (MMS)',
      'MVRV',
      'Preço Realizado',
    ])
    expect(names('Macro & Liquidez')).toEqual([
      'Índice de Liquidez Global (GLI)',
      'Condições Financeiras (NFCI)',
    ])
    expect(names('Gerais')).toEqual([
      'Média Móvel Exponencial (MME)',
      'Média Móvel Simples (MMS)',
      'MACD',
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
