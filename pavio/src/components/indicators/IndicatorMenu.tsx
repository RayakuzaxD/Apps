import { ChartLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  INDICATORS,
  INDICATOR_TYPES,
  PACKS,
  type IndicatorType,
} from '../../domain/indicators/registry'
import toolbar from '../toolbar/Toolbar.module.css'
import styles from './Indicators.module.css'

interface IndicatorMenuProps {
  count: number
  max: number
  onAdd: (type: IndicatorType) => void
}

export function IndicatorMenu({ count, max, onAdd }: IndicatorMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const full = count >= max

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className={styles.menu} ref={rootRef}>
      <button
        type="button"
        className={toolbar.button}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ChartLine size={16} aria-hidden="true" />
        <span className={styles.menuLabel}>Indicadores</span>
        {count > 0 && <span className={styles.count}>{count}</span>}
      </button>
      {open && (
        <div className={styles.menuPopover} role="menu" aria-label="Adicionar indicador">
          {PACKS.map((pack) => {
            const types = INDICATOR_TYPES.filter((type) => INDICATORS[type].pack === pack.id)
            if (types.length === 0) return null
            return (
              <div key={pack.id} role="group" aria-label={pack.name} className={styles.menuGroup}>
                <p className={styles.menuGroupTitle} aria-hidden="true">
                  {pack.name}
                </p>
                {types.map((type) => {
                  const def = INDICATORS[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      disabled={full}
                      onClick={() => {
                        onAdd(type)
                        setOpen(false)
                      }}
                    >
                      <span className={styles.menuTitle}>
                        {def.name} <span className={styles.menuShort}>({def.short})</span>
                      </span>
                      <span className={styles.menuDescription}>{def.description}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
          {full && <p className={styles.menuNote}>Limite de {max} indicadores atingido.</p>}
        </div>
      )}
    </div>
  )
}
