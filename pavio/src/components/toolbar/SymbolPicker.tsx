import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { formatSymbol } from '../../domain/symbols'
import { buildOptions } from './symbolOptions'
import styles from './Toolbar.module.css'

interface SymbolPickerProps {
  value: string
  onChange: (symbol: string) => void
}

export function SymbolPicker({ value, onChange }: SymbolPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const options = useMemo(() => buildOptions(query), [query])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const toggle = () => {
    setQuery('')
    setActive(0)
    setOpen((o) => !o)
  }

  const select = (symbol: string) => {
    onChange(symbol)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const option = options[active]
      if (option) select(option.symbol)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.picker} ref={rootRef}>
      <button
        type="button"
        className={styles.symbolButton}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Par: ${formatSymbol(value)}. Trocar par`}
        onClick={toggle}
      >
        {formatSymbol(value)}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label="Selecionar par">
          <input
            className={styles.input}
            role="combobox"
            aria-label="Buscar par"
            aria-controls={listId}
            aria-expanded="true"
            aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
            placeholder="Buscar ou digitar (ex.: PEPEUSDT)"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
          />
          {options.length > 0 ? (
            <ul className={styles.list} id={listId} role="listbox" aria-label="Pares">
              {options.map((option, i) => (
                <li
                  key={option.symbol}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={styles.option}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => select(option.symbol)}
                >
                  <span>{formatSymbol(option.symbol)}</span>
                  <span className={styles.optionHint}>
                    {option.custom ? 'abrir par' : option.symbol === value ? 'atual' : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>Nenhum par encontrado.</p>
          )}
        </div>
      )}
    </div>
  )
}
