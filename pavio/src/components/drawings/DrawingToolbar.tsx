import { Minus, MousePointer2, Rows4, Slash, Trash2, X, type LucideIcon } from 'lucide-react'
import { DRAWING_LABELS, type DrawingTool } from '../../domain/drawings/types'
import styles from './DrawingToolbar.module.css'

interface DrawingToolbarProps {
  tool: DrawingTool
  hasSelection: boolean
  drawingCount: number
  onToolChange: (tool: DrawingTool) => void
  onRemoveSelected: () => void
  onRemoveAll: () => void
}

const TOOLS: { id: DrawingTool; label: string; icon: LucideIcon; shortcut?: string }[] = [
  { id: 'cursor', label: 'Cursor (selecionar e mover)', icon: MousePointer2 },
  { id: 'trend', label: DRAWING_LABELS.trend, icon: Slash },
  { id: 'horizontal', label: DRAWING_LABELS.horizontal, icon: Minus },
  { id: 'fib', label: DRAWING_LABELS.fib, icon: Rows4 },
]

export function DrawingToolbar({
  tool,
  hasSelection,
  drawingCount,
  onToolChange,
  onRemoveSelected,
  onRemoveAll,
}: DrawingToolbarProps) {
  return (
    <nav className={styles.toolbar} aria-label="Ferramentas de desenho">
      {TOOLS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={styles.tool}
          aria-label={label}
          title={label}
          aria-pressed={tool === id}
          onClick={() => onToolChange(id)}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      ))}
      <div className={styles.divider} />
      <button
        type="button"
        className={styles.tool}
        aria-label="Remover desenho selecionado (Delete)"
        title="Remover desenho selecionado (Delete)"
        disabled={!hasSelection}
        onClick={onRemoveSelected}
      >
        <X size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.tool}
        aria-label="Remover todos os desenhos deste par"
        title="Remover todos os desenhos deste par"
        disabled={drawingCount === 0}
        onClick={onRemoveAll}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </nav>
  )
}
