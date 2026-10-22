import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TimeframeSelect } from './TimeframeSelect'

it('marca o intervalo atual e troca ao clicar', async () => {
  const onChange = vi.fn()
  render(<TimeframeSelect value="1h" onChange={onChange} />)
  expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
    '1m',
    '5m',
    '15m',
    '1h',
    '4h',
    '1D',
    '1S',
    '1M',
  ])
  expect(screen.getByRole('button', { name: '1M' })).toHaveAttribute('title', '1 mês')
  expect(screen.getByRole('button', { name: '1m' })).toHaveAttribute('title', '1 minuto')
  expect(screen.getByRole('button', { name: '1h' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: '1D' }))
  expect(onChange).toHaveBeenCalledWith('1d')
})
