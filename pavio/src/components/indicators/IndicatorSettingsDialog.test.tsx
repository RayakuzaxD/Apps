import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defaultParams, type IndicatorConfig } from '../../domain/indicators/registry'
import { IndicatorSettingsDialog } from './IndicatorSettingsDialog'

const macdConfig: IndicatorConfig = {
  id: 'm1',
  type: 'macd',
  params: defaultParams('macd'),
  visible: true,
}

function setup(config: IndicatorConfig = macdConfig) {
  const onApply = vi.fn()
  const onClose = vi.fn()
  render(<IndicatorSettingsDialog config={config} onApply={onApply} onClose={onClose} />)
  return { onApply, onClose }
}

describe('IndicatorSettingsDialog', () => {
  it('mostra os parâmetros atuais e foca o primeiro campo', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'MACD' })).toBeInTheDocument()
    expect(screen.getByLabelText('MME rápida')).toHaveValue(12)
    expect(screen.getByLabelText('MME lenta')).toHaveValue(26)
    expect(screen.getByLabelText('Sinal')).toHaveValue(9)
    expect(screen.getByLabelText('Fonte')).toHaveValue('close')
    expect(screen.getByLabelText('MME rápida')).toHaveFocus()
  })

  it('aplica parâmetros editados e fecha', async () => {
    const { onApply, onClose } = setup()
    const signal = screen.getByLabelText('Sinal')
    await userEvent.clear(signal)
    await userEvent.type(signal, '5')
    await userEvent.selectOptions(screen.getByLabelText('Fonte'), 'hlc3')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(onApply).toHaveBeenCalledWith({ ...defaultParams('macd'), signal: 5, source: 'hlc3' })
    expect(onClose).toHaveBeenCalled()
  })

  it('mantém o foco no campo que está sendo editado', async () => {
    setup()
    const slow = screen.getByLabelText('MME lenta')
    await userEvent.click(slow)
    await userEvent.type(slow, '0')
    expect(slow).toHaveFocus()
    expect(slow).toHaveValue(260)
  })

  it('valida e bloqueia valores inválidos', async () => {
    const { onApply } = setup()
    const fast = screen.getByLabelText('MME rápida')
    await userEvent.clear(fast)
    await userEvent.type(fast, '30')
    expect(screen.getByRole('alert')).toHaveTextContent('A MME lenta deve ser maior que a rápida.')
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()

    await userEvent.clear(fast)
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um número.')
    expect(fast).toHaveAttribute('aria-invalid', 'true')
    await userEvent.keyboard('{Enter}')
    expect(onApply).not.toHaveBeenCalled()
  })

  it('restaura os padrões', async () => {
    setup({ ...macdConfig, params: { ...defaultParams('macd'), fast: 5, slow: 35 } })
    expect(screen.getByLabelText('MME rápida')).toHaveValue(5)
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }))
    expect(screen.getByLabelText('MME rápida')).toHaveValue(12)
    expect(screen.getByLabelText('MME lenta')).toHaveValue(26)
  })

  it('cancela com o botão, com Escape e pelo X sem aplicar', async () => {
    const { onApply, onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('aceita multiplicador decimal nas Bandas de Bollinger', async () => {
    const { onApply } = setup({ id: 'b', type: 'bb', params: defaultParams('bb'), visible: true })
    const mult = screen.getByLabelText('Desvios padrão')
    await userEvent.clear(mult)
    await userEvent.type(mult, '2.5')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(onApply).toHaveBeenCalledWith({ ...defaultParams('bb'), multiplier: 2.5 })
  })
})
