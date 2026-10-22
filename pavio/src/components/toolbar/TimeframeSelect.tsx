import { INTERVALS } from '../../domain/intervals'
import type { IntervalId } from '../../domain/types'
import styles from './Toolbar.module.css'

interface TimeframeSelectProps {
  value: IntervalId
  onChange: (interval: IntervalId) => void
}

export function TimeframeSelect({ value, onChange }: TimeframeSelectProps) {
  return (
    <div className={styles.group} role="group" aria-label="Timeframe">
      {INTERVALS.map((interval) => (
        <button
          key={interval.id}
          type="button"
          className={styles.button}
          aria-pressed={interval.id === value}
          title={interval.name}
          onClick={() => onChange(interval.id)}
        >
          {interval.label}
        </button>
      ))}
    </div>
  )
}
