import { useEffect, useId, useRef, useState } from 'react'
import { INDICATORS, type IndicatorType } from '../../domain/indicators/registry'
import styles from './Indicators.module.css'

interface IndicatorInfoProps {
  type: IndicatorType
  label: string
}

/** Nome do indicador; tocar ou clicar abre "o que é / como ler" (pensado para o celular). */
export function IndicatorInfo({ type, label }: IndicatorInfoProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const id = useId()
  const def = INDICATORS[type]

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
    <span className={styles.info} ref={rootRef}>
      <button
        type="button"
        className={styles.nameButton}
        aria-expanded={open}
        aria-controls={id}
        title={`${def.name}: o que é e como ler`}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <span className={styles.infoPopover} id={id} role="dialog" aria-label={def.name}>
          <h3>{def.name}</h3>
          <p>
            <span className={styles.infoLabel}>O que é: </span>
            {def.about.what}
          </p>
          <p>
            <span className={styles.infoLabel}>Como ler: </span>
            {def.about.howToRead}
          </p>
        </span>
      )}
    </span>
  )
}
