import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SymbolPicker } from './SymbolPicker'
import { buildOptions } from './symbolOptions'

describe('buildOptions', () => {
  it('filtra os pares populares', () => {
    expect(buildOptions('eth').map((o) => o.symbol)).toEqual(['ETHUSDT'])
  })

  it('oferece abrir um par digitado fora da lista', () => {
    expect(buildOptions('pepe/usdt')[0]).toEqual({ symbol: 'PEPEUSDT', custom: true })
  })

  it('não oferece entrada inválida', () => {
    expect(buildOptions('zz')).toEqual([])
  })
})

describe('SymbolPicker', () => {
  it('seleciona um par pelo clique', async () => {
    const onChange = vi.fn()
    render(<SymbolPicker value="BTCUSDT" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /BTC\/USDT/ }))
    await userEvent.click(screen.getByRole('option', { name: /SOL\/USDT/ }))
    expect(onChange).toHaveBeenCalledWith('SOLUSDT')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('navega pelo teclado e confirma com Enter', async () => {
    const onChange = vi.fn()
    render(<SymbolPicker value="BTCUSDT" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /BTC\/USDT/ }))
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('ETHUSDT')
  })

  it('abre par digitado', async () => {
    const onChange = vi.fn()
    render(<SymbolPicker value="BTCUSDT" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /BTC\/USDT/ }))
    await userEvent.type(screen.getByRole('combobox'), 'pepeusdt{Enter}')
    expect(onChange).toHaveBeenCalledWith('PEPEUSDT')
  })

  it('fecha com Escape sem selecionar', async () => {
    const onChange = vi.fn()
    render(<SymbolPicker value="BTCUSDT" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /BTC\/USDT/ }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
