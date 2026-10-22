import { PanelRight } from 'lucide-react'
import { ChartView } from '../components/chart/ChartView'
import { Footer } from '../components/common/Footer'
import { Logo } from '../components/common/Logo'
import { DrawingToolbar } from '../components/drawings/DrawingToolbar'
import { IndicatorMenu } from '../components/indicators/IndicatorMenu'
import { ReadingPanel } from '../components/panel/ReadingPanel'
import { SidePanel } from '../components/panel/SidePanel'
import { ConnectionBadge } from '../components/toolbar/ConnectionBadge'
import { SymbolPicker } from '../components/toolbar/SymbolPicker'
import { ThemeMenu } from '../components/toolbar/ThemeMenu'
import { TimeframeSelect } from '../components/toolbar/TimeframeSelect'
import toolbarStyles from '../components/toolbar/Toolbar.module.css'
import { WatchlistPanel } from '../components/watchlist/WatchlistPanel'
import { useIndicatorResults } from '../hooks/useIndicatorResults'
import { useKlines } from '../hooks/useKlines'
import { useDrawingsStore } from '../store/drawingsStore'
import { MAX_INDICATORS, useIndicatorsStore } from '../store/indicatorsStore'
import { usePanelStore } from '../store/panelStore'
import { useSettingsStore } from '../store/settingsStore'
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
  const panelOpen = usePanelStore((s) => s.open)
  const panelTab = usePanelStore((s) => s.tab)
  const setPanelOpen = usePanelStore((s) => s.setOpen)
  const setPanelTab = usePanelStore((s) => s.setTab)
  const klines = useKlines(symbol, interval)
  const results = useIndicatorResults(klines.candles)

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <Logo />
          <span className={styles.brand}>Pavio</span>
        </div>
        <SymbolPicker value={symbol} onChange={setSymbol} />
        <div className={styles.tools}>
          <TimeframeSelect value={interval} onChange={setInterval} />
          <IndicatorMenu count={indicatorCount} max={MAX_INDICATORS} onAdd={addIndicator} />
        </div>
        <div className={styles.spacer} />
        <ConnectionBadge />
        <ThemeMenu value={theme} onChange={setTheme} />
        <button
          type="button"
          className={toolbarStyles.button}
          aria-pressed={panelOpen}
          aria-label={panelOpen ? 'Ocultar painel' : 'Mostrar painel'}
          title="Leitura do dia e watchlist"
          onClick={() => setPanelOpen(!panelOpen)}
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
          <ChartView symbol={symbol} interval={interval} klines={klines} results={results} />
        </div>
        {panelOpen && (
          <SidePanel
            tab={panelTab}
            onTabChange={setPanelTab}
            onClose={() => setPanelOpen(false)}
            reading={
              <ReadingPanel
                symbol={symbol}
                interval={interval}
                candles={klines.candles}
                results={results}
                status={klines.status}
              />
            }
            watchlist={<WatchlistPanel />}
          />
        )}
      </main>
      <Footer />
    </div>
  )
}
