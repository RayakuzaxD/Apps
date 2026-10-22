import { Eye, EyeOff, Settings2, X } from 'lucide-react'
import { formatPrice } from '../../domain/format'
import { INDICATORS, indicatorLabel, type IndicatorResult } from '../../domain/indicators/registry'
import { IndicatorInfo } from './IndicatorInfo'
import styles from './Indicators.module.css'

interface IndicatorLegendRowProps {
  result: IndicatorResult
  /** Índice do candle exibido (sob o crosshair ou o último). */
  index: number | null
  /** Casas decimais de preço do par atual. */
  precision: number
  onToggle: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}

export function IndicatorLegendRow({
  result,
  index,
  precision,
  onToggle,
  onEdit,
  onRemove,
}: IndicatorLegendRowProps) {
  const { config, outputs } = result
  const def = INDICATORS[config.type]
  const label = indicatorLabel(config.type, config.params)
  const digits = def.range ? 2 : precision

  return (
    <div
      className={styles.row}
      data-hidden={!config.visible}
      data-testid={`indicator-${config.type}`}
      data-indicator-id={config.id}
    >
      <IndicatorInfo type={config.type} label={label} />
      <span className={styles.values}>
        {def.outputs.map((output) => {
          const value = index === null ? null : (outputs[output.key]?.[index] ?? null)
          const color =
            output.colorParam !== undefined
              ? String(config.params[output.colorParam])
              : value !== null && value < 0
                ? 'var(--down)'
                : 'var(--up)'
          return (
            <span
              key={output.key}
              style={{ color }}
              title={output.label}
              data-testid={`indicator-value-${output.key}`}
            >
              {value === null ? '–' : formatPrice(value, digits)}
            </span>
          )
        })}
      </span>
      <span className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`${config.visible ? 'Ocultar' : 'Mostrar'} ${label}`}
          aria-pressed={!config.visible}
          onClick={() => onToggle(config.id)}
        >
          {config.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Configurar ${label}`}
          onClick={() => onEdit(config.id)}
        >
          <Settings2 size={14} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Remover ${label}`}
          onClick={() => onRemove(config.id)}
        >
          <X size={14} />
        </button>
      </span>
    </div>
  )
}
