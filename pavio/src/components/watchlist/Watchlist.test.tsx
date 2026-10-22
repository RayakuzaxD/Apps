import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TickerEntry } from '../../hooks/useTickers'
import { BinanceApiError } from '../../services/binance/rest'
import { validateNewSymbol } from './validateNewSymbol'
import { Watchlist } from './Watchlist'

const ready = (price: number, change: number, extra: Partial<TickerEntry> = {}): TickerEntry => ({
  status: 'ready',
  price,
  change,
  direction: null,
  seq: 0,
  ...extra,
})

function setup(overrides: Partial<Parameters<typeof Watchlist>[0]> = {}) {
  const props = {
    symbols: ['BTCUSDT', 'ETHUSDT', 'NOPEUSDT', 'SOLUSDT'],
    tickers: {
      BTCUSDT: ready(83456.7, 0.0123, { direction: 'up', seq: 3 }),
      ETHUSDT: ready(2950.5, -0.045),
      NOPEUSDT: { status: 'error', price: null, change: null, direction: null, seq: 0 },
      SOLUSDT: { status: 'loading', price: null, change: null, direction: null, seq: 0 },
    } satisfies Record<string, TickerEntry>,
    current: 'ETHUSDT',
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    onAdd: vi.fn(async () => null as string | null),
    ...overrides,
  }
  render(<Watchlist {...props} />)
  return props
}

describe('Watchlist', () => {
  it('mostra preço e variação de cada par, com cor por sinal', () => {
    setup()
    const btc = within(screen.getByTestId('watch-BTCUSDT'))
    expect(btc.getByText('BTC')).toBeInTheDocument()
    expect(btc.getByTestId('watch-price')).toHaveTextContent('83.456,70')
    expect(btc.getByTestId('watch-price')).toHaveAttribute('data-flash', 'up')
    expect(btc.getByTestId('watch-change')).toHaveTextContent('+1,23%')
    expect(btc.getByTestId('watch-change')).toHaveAttribute('data-sign', 'up')

    const eth = within(screen.getByTestId('watch-ETHUSDT'))
    expect(eth.getByTestId('watch-change')).toHaveTextContent('-4,50%')
    expect(eth.getByTestId('watch-change')).toHaveAttribute('data-sign', 'down')
    expect(eth.getByTestId('watch-price')).not.toHaveAttribute('data-flash')
  })

  it('estados de carregando e erro', () => {
    setup()
    expect(
      within(screen.getByTestId('watch-SOLUSDT')).getByTestId('watch-price'),
    ).toHaveTextContent('…')
    const nope = within(screen.getByTestId('watch-NOPEUSDT'))
    expect(nope.getByTestId('watch-price')).toHaveTextContent('—')
    expect(nope.getByTestId('watch-change')).toHaveTextContent('indisponível')
  })

  it('destaca o par do gráfico e abre outro ao clicar', async () => {
    const { onSelect } = setup()
    expect(screen.getByTestId('watch-ETHUSDT')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByTestId('watch-BTCUSDT')).not.toHaveAttribute('aria-current')
    await userEvent.click(screen.getByRole('button', { name: 'Abrir BTC/USDT no gráfico' }))
    expect(onSelect).toHaveBeenCalledWith('BTCUSDT')
  })

  it('remove um par', async () => {
    const { onRemove, onSelect } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Remover SOL/USDT da watchlist' }))
    expect(onRemove).toHaveBeenCalledWith('SOLUSDT')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('adiciona pelo formulário e limpa o campo', async () => {
    const { onAdd } = setup()
    const input = screen.getByRole('textbox', { name: 'Adicionar par à watchlist' })
    await userEvent.type(input, 'linkusdt{Enter}')
    expect(onAdd).toHaveBeenCalledWith('linkusdt')
    expect(input).toHaveValue('')
  })

  it('mostra o erro de validação e mantém o texto', async () => {
    setup({ onAdd: vi.fn(async () => 'NOPEUSDT não existe na Binance.') })
    const input = screen.getByRole('textbox', { name: 'Adicionar par à watchlist' })
    await userEvent.type(input, 'nopeusdt')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('NOPEUSDT não existe na Binance.')
    expect(input).toHaveValue('nopeusdt')
    await userEvent.type(input, 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lista vazia mostra orientação', () => {
    setup({ symbols: [], tickers: {} })
    expect(screen.getByText(/watchlist está vazia/)).toBeInTheDocument()
    expect(screen.getByText('0 pares')).toBeInTheDocument()
  })
})

describe('validateNewSymbol', () => {
  const ok = vi.fn(async () => ({}))

  it('normaliza e aceita par existente', async () => {
    expect(await validateNewSymbol(' link/usdt ', ['BTCUSDT'], ok)).toEqual({ symbol: 'LINKUSDT' })
    expect(ok).toHaveBeenCalledWith('LINKUSDT')
  })

  it('rejeita formato inválido e duplicado sem consultar a API', async () => {
    const check = vi.fn()
    expect(await validateNewSymbol('ab', [], check)).toEqual({
      error: expect.stringMatching(/formato/),
    })
    expect(await validateNewSymbol('btcusdt', ['BTCUSDT'], check)).toEqual({
      error: 'BTCUSDT já está na watchlist.',
    })
    expect(check).not.toHaveBeenCalled()
  })

  const same = async (error: unknown) => error

  it('par que não existe na Binance', async () => {
    const check = vi.fn(async () => {
      throw new BinanceApiError('Invalid symbol.', 400, -1121)
    })
    expect(await validateNewSymbol('nopeusdt', [], check, same)).toEqual({
      error: 'NOPEUSDT não existe na Binance.',
    })
  })

  it('erro de rede explicado como par inexistente (resposta bloqueada por CORS)', async () => {
    const check = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const explain = vi.fn(async () => new BinanceApiError('Invalid symbol.', 400, -1121))
    expect(await validateNewSymbol('foobarusdt', [], check, explain)).toEqual({
      error: 'FOOBARUSDT não existe na Binance.',
    })
  })

  it('falha de rede', async () => {
    const check = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await validateNewSymbol('linkusdt', [], check, same)).toEqual({
      error: expect.stringMatching(/conexão/),
    })
  })
})
