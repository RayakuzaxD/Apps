import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DrawingToolbar } from './DrawingToolbar'

function setup(props: Partial<Parameters<typeof DrawingToolbar>[0]> = {}) {
  const handlers = {
    onToolChange: vi.fn(),
    onRemoveSelected: vi.fn(),
    onRemoveAll: vi.fn(),
  }
  render(
    <DrawingToolbar tool="cursor" hasSelection={false} drawingCount={0} {...handlers} {...props} />,
  )
  return handlers
}

describe('DrawingToolbar', () => {
  it('marca a ferramenta ativa e troca ao clicar', async () => {
    const { onToolChange } = setup({ tool: 'fib' })
    expect(screen.getByRole('button', { name: 'Retração de Fibonacci' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Cursor/ })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Linha de tendência' }))
    await userEvent.click(screen.getByRole('button', { name: 'Linha horizontal' }))
    expect(onToolChange.mock.calls).toEqual([['trend'], ['horizontal']])
  })

  it('botões de remoção ficam desabilitados sem seleção ou sem desenhos', () => {
    setup()
    expect(screen.getByRole('button', { name: /Remover desenho selecionado/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Remover todos/ })).toBeDisabled()
  })

  it('remove o selecionado e todos', async () => {
    const { onRemoveSelected, onRemoveAll } = setup({ hasSelection: true, drawingCount: 3 })
    await userEvent.click(screen.getByRole('button', { name: /Remover desenho selecionado/ }))
    await userEvent.click(screen.getByRole('button', { name: /Remover todos/ }))
    expect(onRemoveSelected).toHaveBeenCalled()
    expect(onRemoveAll).toHaveBeenCalled()
  })
})
