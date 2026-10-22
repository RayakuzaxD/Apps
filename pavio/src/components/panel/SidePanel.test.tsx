import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { SidePanel } from './SidePanel'

it('abas trocam o conteúdo e o botão fecha o painel', async () => {
  const onTabChange = vi.fn()
  const onClose = vi.fn()
  const { rerender } = render(
    <SidePanel
      tab="reading"
      onTabChange={onTabChange}
      onClose={onClose}
      reading={<p>conteúdo da leitura</p>}
      watchlist={<p>conteúdo da watchlist</p>}
    />,
  )
  expect(screen.getByRole('tab', { name: 'Leitura do dia' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByRole('tabpanel')).toHaveTextContent('conteúdo da leitura')

  await userEvent.click(screen.getByRole('tab', { name: 'Watchlist' }))
  expect(onTabChange).toHaveBeenCalledWith('watchlist')
  rerender(
    <SidePanel
      tab="watchlist"
      onTabChange={onTabChange}
      onClose={onClose}
      reading={<p>conteúdo da leitura</p>}
      watchlist={<p>conteúdo da watchlist</p>}
    />,
  )
  expect(screen.getByRole('tabpanel')).toHaveTextContent('conteúdo da watchlist')

  await userEvent.click(screen.getByRole('button', { name: 'Fechar painel' }))
  expect(onClose).toHaveBeenCalled()
})
