import { Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { pricePrecision } from '../../domain/candles'
import { formatPercent, formatPrice } from '../../domain/format'
import { splitSymbol } from '../../domain/symbols'
import type { TickerEntry } from '../../hooks/useTickers'
import styles from './Watchlist.module.css'

interface WatchlistProps {
  symbols: readonly string[]
  tickers: Record<string, TickerEntry>
  current: string
  onSelect: (symbol: string) => void
  onRemove: (symbol: string) => void
  /** Tenta adicionar; resolve com mensagem de erro ou null em caso de sucesso. */
  onAdd: (input: string) => Promise<string | null>
}

export function Watchlist({
  symbols,
  tickers,
  current,
  onSelect,
  onRemove,
  onAdd,
}: WatchlistProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || adding) return
    setAdding(true)
    const message = await onAdd(input)
    setAdding(false)
    setError(message)
    if (!message) setInput('')
  }

  return (
    <aside className={styles.panel} aria-label="Watchlist">
      <div className={styles.header}>
        <h2 className={styles.title}>Watchlist</h2>
        <span className={styles.count}>{symbols.length} pares</span>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <input
          className={styles.input}
          aria-label="Adicionar par à watchlist"
          placeholder="Adicionar par (ex.: LINKUSDT)"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          aria-invalid={error ? true : undefined}
        />
        <button type="submit" className={styles.addButton} aria-label="Adicionar" disabled={adding}>
          <Plus size={16} aria-hidden="true" />
        </button>
      </form>
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.columns} aria-hidden="true">
        <span>Par</span>
        <span>Último</span>
        <span>Var. 24h</span>
      </div>
      {symbols.length === 0 ? (
        <p className={styles.empty}>Sua watchlist está vazia. Adicione um par acima.</p>
      ) : (
        <ul className={styles.list}>
          {symbols.map((symbol) => (
            <WatchlistRow
              key={symbol}
              symbol={symbol}
              ticker={tickers[symbol]}
              current={symbol === current}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </aside>
  )
}

interface WatchlistRowProps {
  symbol: string
  ticker: TickerEntry | undefined
  current: boolean
  onSelect: (symbol: string) => void
  onRemove: (symbol: string) => void
}

function WatchlistRow({ symbol, ticker, current, onSelect, onRemove }: WatchlistRowProps) {
  const { base, quote } = splitSymbol(symbol)
  const label = quote ? `${base}/${quote}` : base
  const ready = ticker?.status === 'ready' && ticker.price !== null
  const change = ready ? (ticker.change ?? 0) : null
  const sign = change === null || change === 0 ? undefined : change > 0 ? 'up' : 'down'

  return (
    <li
      className={styles.row}
      aria-current={current ? 'true' : undefined}
      data-testid={`watch-${symbol}`}
    >
      <button
        type="button"
        className={styles.select}
        aria-label={`Abrir ${label} no gráfico`}
        onClick={() => onSelect(symbol)}
      >
        <span className={styles.name}>
          {base}
          {quote && <span className={styles.quote}>/{quote}</span>}
        </span>
        {ready ? (
          <span
            key={ticker.seq}
            className={styles.price}
            data-flash={ticker.seq > 0 ? (ticker.direction ?? undefined) : undefined}
            data-testid="watch-price"
          >
            {formatPrice(ticker.price!, pricePrecision(ticker.price!))}
          </span>
        ) : (
          <span className={`${styles.price} ${styles.muted}`} data-testid="watch-price">
            {ticker?.status === 'error' ? '—' : '…'}
          </span>
        )}
        <span
          className={`${styles.change} ${change === null ? styles.muted : ''}`}
          data-sign={sign}
          data-testid="watch-change"
        >
          {change !== null
            ? formatPercent(change)
            : ticker?.status === 'error'
              ? 'indisponível'
              : ''}
        </span>
      </button>
      <button
        type="button"
        className={styles.remove}
        aria-label={`Remover ${label} da watchlist`}
        onClick={() => onRemove(symbol)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  )
}
