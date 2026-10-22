import { useEffect, useMemo, useRef, useState } from 'react'
import { ChartController } from '../../chart/ChartController'
import { readChartTheme } from '../../chart/theme'
import { findCandleIndex, pricePrecision } from '../../domain/candles'
import { DRAWING_LABELS } from '../../domain/drawings/types'
import { INDICATORS, computeIndicator } from '../../domain/indicators/registry'
import type { IntervalId } from '../../domain/types'
import { useChartDrawings } from '../../hooks/useChartDrawings'
import { useKlines, type OlderStatus } from '../../hooks/useKlines'
import { usePaneTops } from '../../hooks/usePaneTops'
import { describeLoadError } from '../../services/binance'
import { useDrawingsStore } from '../../store/drawingsStore'
import { useIndicatorsStore } from '../../store/indicatorsStore'
import { useResolvedTheme } from '../../theme/theme'
import { IndicatorLegendRow } from '../indicators/IndicatorLegendRow'
import { IndicatorSettingsDialog } from '../indicators/IndicatorSettingsDialog'
import { ChartLegend } from './ChartLegend'
import styles from './ChartView.module.css'

interface ChartViewProps {
  symbol: string
  interval: IntervalId
}

export function ChartView({ symbol, interval }: ChartViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [controller, setController] = useState<ChartController | null>(null)
  // Horário (e não índice) do candle sob o cursor: o índice muda quando entra histórico anterior.
  const [hoveredTime, setHoveredTime] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [leftEdgeVisible, setLeftEdgeVisible] = useState(false)
  const { candles, status, error, retry, older, loadOlder, retryOlder } = useKlines(
    symbol,
    interval,
  )
  const resolvedTheme = useResolvedTheme()

  const configs = useIndicatorsStore((s) => s.indicators)
  const updateIndicator = useIndicatorsStore((s) => s.update)
  const toggleIndicator = useIndicatorsStore((s) => s.toggle)
  const removeIndicator = useIndicatorsStore((s) => s.remove)

  const results = useMemo(
    () => configs.map((config) => computeIndicator(config, candles)),
    [configs, candles],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ctl = new ChartController(el, readChartTheme())
    const offCrosshair = ctl.onCrosshair(setHoveredTime)
    const offLeftEdge = ctl.onLeftEdgeVisible(setLeftEdgeVisible)

    setController(ctl)
    return () => {
      offCrosshair()
      offLeftEdge()
      ctl.destroy()
      setController(null)
    }
  }, [])

  // Tema efetivo mudou (preferência ou sistema): relê as cores dos tokens CSS.
  // O atributo data-theme já foi aplicado de forma síncrona (theme/theme.ts).
  useEffect(() => {
    controller?.applyTheme(readChartTheme())
  }, [controller, resolvedTheme])

  useEffect(() => controller?.onNeedOlder(loadOlder), [controller, loadOlder])

  // Precisa rodar antes de usePaneTops: é aqui que os painéis são criados.
  useEffect(() => {
    controller?.setData(`${symbol}:${interval}`, interval, candles, results)
  }, [controller, symbol, interval, candles, results])

  const { draftPoints } = useChartDrawings(controller, containerRef, symbol)
  const tool = useDrawingsStore((s) => s.tool)

  const overlays = results.filter((r) => INDICATORS[r.config.type].placement === 'overlay')
  const panes = results.filter((r) => INDICATORS[r.config.type].placement === 'pane')
  const paneTops = usePaneTops(
    controller,
    wrapperRef,
    panes.map((r) => r.config.id),
  )

  const hoveredIndex = hoveredTime === null ? -1 : findCandleIndex(candles, hoveredTime)
  const index = hoveredIndex >= 0 ? hoveredIndex : candles.length > 0 ? candles.length - 1 : null
  const legendCandle = index === null ? null : (candles[index] ?? null)
  const precision = pricePrecision(candles[candles.length - 1]?.close ?? 1)
  const editing = configs.find((c) => c.id === editingId) ?? null

  const rowProps = {
    index,
    precision,
    onToggle: toggleIndicator,
    onEdit: setEditingId,
    onRemove: removeIndicator,
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef} data-tool={tool}>
      <div ref={containerRef} className={styles.canvas} data-testid="chart" />
      <div className={styles.legendStack}>
        <ChartLegend symbol={symbol} interval={interval} candle={legendCandle} />
        {overlays.map((result) => (
          <IndicatorLegendRow key={result.config.id} result={result} {...rowProps} />
        ))}
      </div>
      {panes.map((result) => {
        const top = paneTops[result.config.id]
        if (top === undefined) return null
        return (
          <div
            key={result.config.id}
            className={styles.paneLegend}
            style={{ top: top + 4 }}
            data-testid="pane-legend"
          >
            <IndicatorLegendRow result={result} {...rowProps} />
          </div>
        )
      })}
      {tool !== 'cursor' && (
        <div className={styles.hint} role="status" data-testid="drawing-hint">
          <strong>{DRAWING_LABELS[tool]}:</strong>{' '}
          {tool === 'horizontal'
            ? 'clique no preço desejado'
            : draftPoints === 0
              ? 'clique no ponto inicial'
              : 'clique no ponto final'}{' '}
          · Esc cancela
        </div>
      )}
      {status === 'ready' && (
        <OlderHistoryStatus older={older} edgeVisible={leftEdgeVisible} onRetry={retryOlder} />
      )}
      {status === 'loading' && (
        <div className={styles.overlay} role="status">
          Carregando dados…
        </div>
      )}
      {status === 'error' && (
        <div className={styles.overlay} role="alert">
          <p>{describeLoadError(error, symbol)}</p>
          <button type="button" className={styles.retry} onClick={retry}>
            Tentar de novo
          </button>
        </div>
      )}
      {editing && (
        <IndicatorSettingsDialog
          key={editing.id}
          config={editing}
          onApply={(params) => updateIndicator(editing.id, params)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

interface OlderHistoryStatusProps {
  older: OlderStatus
  /** O primeiro candle está na tela: só então faz sentido avisar que não há mais. */
  edgeVisible: boolean
  onRetry: () => void
}

function OlderHistoryStatus({ older, edgeVisible, onRetry }: OlderHistoryStatusProps) {
  if (older === 'idle') return null
  if ((older === 'end' || older === 'limit') && !edgeVisible) return null
  if (older === 'error') {
    return (
      <div className={styles.olderStatus} role="alert" data-testid="older-status">
        Falha ao carregar histórico anterior ·{' '}
        <button type="button" className={styles.olderRetry} onClick={onRetry}>
          Tentar de novo
        </button>
      </div>
    )
  }
  return (
    <div className={styles.olderStatus} role="status" data-testid="older-status">
      {OLDER_LABELS[older]}
    </div>
  )
}

const OLDER_LABELS: Record<Exclude<OlderStatus, 'idle' | 'error'>, string> = {
  loading: 'Carregando histórico…',
  end: 'Início do histórico',
  limit: 'Limite de histórico atingido',
}
