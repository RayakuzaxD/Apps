import { useStreamStatus } from '../../hooks/useStreamStatus'
import type { StreamStatus } from '../../services/binance'
import styles from './Toolbar.module.css'

const LABELS: Record<StreamStatus, string> = {
  idle: 'Desconectado',
  connecting: 'Conectando…',
  open: 'Ao vivo',
  reconnecting: 'Reconectando…',
}

export function ConnectionBadge() {
  const status = useStreamStatus()
  return (
    <span className={styles.badge} role="status" data-testid="connection-status">
      <span className={styles.dot} data-status={status} aria-hidden="true" />
      {LABELS[status]}
    </span>
  )
}
