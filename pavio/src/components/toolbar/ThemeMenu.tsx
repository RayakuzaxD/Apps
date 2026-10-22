import { Check, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ThemeSetting } from '../../store/settingsStore'
import styles from './Toolbar.module.css'

interface ThemeMenuProps {
  value: ThemeSetting
  onChange: (theme: ThemeSetting) => void
}

const OPTIONS: { id: ThemeSetting; label: string; icon: LucideIcon }[] = [
  { id: 'system', label: 'Automático (sistema)', icon: Monitor },
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Escuro', icon: Moon },
]

export function ThemeMenu({ value, onChange }: ThemeMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0]!
  const Icon = current.icon

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
    <div className={styles.picker} ref={rootRef}>
      <button
        type="button"
        className={styles.button}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Tema: ${current.label}`}
        title={`Tema: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className={`${styles.popover} ${styles.popoverRight}`} role="menu" aria-label="Tema">
          {OPTIONS.map(({ id, label, icon: OptionIcon }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={id === value}
              className={styles.menuOption}
              onClick={() => {
                onChange(id)
                setOpen(false)
              }}
            >
              <OptionIcon size={16} aria-hidden="true" />
              <span>{label}</span>
              {id === value && <Check size={16} aria-hidden="true" className={styles.check} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
