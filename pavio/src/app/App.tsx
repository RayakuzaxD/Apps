import { PanelRight } from 'lucide-react'
import { ChartView } from '../components/chart/ChartView'
import { Footer } from '../components/common/Footer'
import { Logo } from '../components/common/Logo'
import { DrawingToolbar } from '../components/drawings/DrawingToolbar'
import { IndicatorMenu } from '../components/indicators/IndicatorMenu'
import { ConnectionBadge } from '../components/toolbar/ConnectionBadge'
import { SymbolPicker } from '../components/toolbar/SymbolPicker'
import { ThemeMenu } from '../components/toolbar/ThemeMenu'
import { TimeframeSelect } from '../components/toolbar/TimeframeSelect'
import toolbarStyles from '../components/toolbar/Toolbar.module.css'
import { WatchlistPanel } from '../components/watchlist/WatchlistPanel'
import { useDrawingsStore } from '../store/drawingsStore'
import { MAX_INDICATORS, useIndicatorsStore } from '../store/indicatorsStore'
import { useSettingsStore } from '../store/settingsStore'
import { useWatchlistStore } from '../store/watchlistStore'
import styles from './App.module.css'

export function App() {
  const symbol = useSettingsStore((s) => s.symbol)
  const interval = useSettingsStore((s) => s.interval)
  const setSymbol = useSettingsStore((s) => s.setSymbol)
  const setInterval = useSettingsStore((s) => s.setInterval)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const indicatorCount = useIndicatorsStore((s) => s.indicators.length)
  const addIndicator = useIndicatorsStore((s) => s.add)
  const tool = useDrawingsStore((s) => s.tool)
  const selectedDrawing = useDrawingsStore((s) => s.selectedId)
  const drawingCount = useDrawingsStore((s) => s.drawings.filter((d) => d.symbol === symbol).length)
  const setTool = useDrawingsStore((s) => s.setTool)
  const removeDrawing = useDrawingsStore((s) => s.remove)
  const removeAllDrawings = useDrawingsStore((s) => s.removeAllForSymbol)
  const watchlistOpen = useWatchlistStore((s) => s.open)
  const setWatchlistOpen = useWatchlistStore((s) => s.setOpen)

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
        <ThemeMenu value={theme} onChange={setTheme} />
        <button
          type="button"
          className={toolbarStyles.button}
          aria-pressed={watchlistOpen}
          aria-label={watchlistOpen ? 'Ocultar watchlist' : 'Mostrar watchlist'}
          title="Watchlist"
          onClick={() => setWatchlistOpen(!watchlistOpen)}
        >
          <PanelRight size={18} aria-hidden="true" />
        </button>
      </header>
      <main className={styles.main}>
        <DrawingToolbar
          tool={tool}
          hasSelection={selectedDrawing !== null}
          drawingCount={drawingCount}
          onToolChange={setTool}
          onRemoveSelected={() => selectedDrawing && removeDrawing(selectedDrawing)}
          onRemoveAll={() => {
            if (window.confirm(`Remover todos os ${drawingCount} desenhos de ${symbol}?`)) {
              removeAllDrawings(symbol)
            }
          }}
        />
        <div className={styles.chartArea}>
          <ChartView symbol={symbol} interval={interval} />
        </div>
        {watchlistOpen && <WatchlistPanel />}
      </main>
      <Footer />
    </div>
  )
}
