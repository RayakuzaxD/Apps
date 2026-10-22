import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThemeMenu } from './ThemeMenu'

describe('ThemeMenu', () => {
  it('mostra o tema atual e marca a opção escolhida', async () => {
    render(<ThemeMenu value="dark" onChange={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Tema: Escuro' })
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'Escuro' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Claro' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('troca o tema e fecha', async () => {
    const onChange = vi.fn()
    render(<ThemeMenu value="system" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Tema: Automático (sistema)' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Claro' }))
    expect(onChange).toHaveBeenCalledWith('light')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('fecha com Escape sem trocar', async () => {
    const onChange = vi.fn()
    render(<ThemeMenu value="light" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Tema: Claro' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
