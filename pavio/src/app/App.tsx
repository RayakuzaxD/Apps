import { ChartView } from '../components/chart/ChartView'
import { Footer } from '../components/common/Footer'
import { Logo } from '../components/common/Logo'
import { ConnectionBadge } from '../components/toolbar/ConnectionBadge'
import { SymbolPicker } from '../components/toolbar/SymbolPicker'
import { TimeframeSelect } from '../components/toolbar/TimeframeSelect'
import { useSettingsStore } from '../store/settingsStore'
import styles from './App.module.css'

export function App() {
  const symbol = useSettingsStore((s) => s.symbol)
  const interval = useSettingsStore((s) => s.interval)
  const setSymbol = useSettingsStore((s) => s.setSymbol)
  const setInterval = useSettingsStore((s) => s.setInterval)

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <Logo />
          <span className={styles.brand}>Pavio</span>
        </div>
        <SymbolPicker value={symbol} onChange={setSymbol} />
        <TimeframeSelect value={interval} onChange={setInterval} />
        <div className={styles.spacer} />
        <ConnectionBadge />
      </header>
      <main className={styles.main}>
        <ChartView symbol={symbol} interval={interval} />
      </main>
      <Footer />
    </div>
  )
}
