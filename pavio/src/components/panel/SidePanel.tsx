import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PanelTab } from '../../store/panelStore'
import styles from './Panel.module.css'

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'reading', label: 'Leitura do dia' },
  { id: 'watchlist', label: 'Watchlist' },
]

interface SidePanelProps {
  tab: PanelTab
  onTabChange: (tab: PanelTab) => void
  onClose: () => void
  reading: ReactNode
  watchlist: ReactNode
}

/** Painel lateral com abas; no celular, flutua sobre o gráfico. */
export function SidePanel({ tab, onTabChange, onClose, reading, watchlist }: SidePanelProps) {
  return (
    <aside className={styles.panel} aria-label="Painel lateral">
      <div className={styles.tabs} role="tablist" aria-label="Conteúdo do painel">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`panel-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={styles.tab}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button type="button" className={styles.close} aria-label="Fechar painel" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div
        className={styles.body}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`panel-tab-${tab}`}
      >
        {tab === 'reading' ? reading : watchlist}
      </div>
    </aside>
  )
}
