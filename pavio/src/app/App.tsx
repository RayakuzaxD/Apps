import { ChartView } from '../components/chart/ChartView'
import { Footer } from '../components/common/Footer'
import { Logo } from '../components/common/Logo'
import { IndicatorMenu } from '../components/indicators/IndicatorMenu'
import { ConnectionBadge } from '../components/toolbar/ConnectionBadge'
import { SymbolPicker } from '../components/toolbar/SymbolPicker'
import { TimeframeSelect } from '../components/toolbar/TimeframeSelect'
import { MAX_INDICATORS, useIndicatorsStore } from '../store/indicatorsStore'
import { useSettingsStore } from '../store/settingsStore'
import styles from './App.module.css'

export function App() {
  const symbol = useSettingsStore((s) => s.symbol)
  const interval = useSettingsStore((s) => s.interval)
  const setSymbol = useSettingsStore((s) => s.setSymbol)
  const setInterval = useSettingsStore((s) => s.setInterval)
  const indicatorCount = useIndicatorsStore((s) => s.indicators.length)
  const addIndicator = useIndicatorsStore((s) => s.add)

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <Logo />
          <span className={styles.brand}>Pavio</span>
        </div>
        <SymbolPicker value={symbol} onChange={setSymbol} />
        <TimeframeSelect value={interval} onChange={setInterval} />
        <IndicatorMenu count={indicatorCount} max={MAX_INDICATORS} onAdd={addIndicator} />
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
