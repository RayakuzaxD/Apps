import { useEffect, useRef, useState } from 'react'
import { ChartController } from '../../chart/ChartController'
import { readChartTheme } from '../../chart/theme'
import type { Candle, IntervalId } from '../../domain/types'
import { useKlines } from '../../hooks/useKlines'
import { describeLoadError } from '../../services/binance'
import { ChartLegend } from './ChartLegend'
import styles from './ChartView.module.css'

interface ChartViewProps {
  symbol: string
  interval: IntervalId
}

export function ChartView({ symbol, interval }: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [controller, setController] = useState<ChartController | null>(null)
  const [hovered, setHovered] = useState<Candle | null>(null)
  const { candles, status, error, retry } = useKlines(symbol, interval)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ctl = new ChartController(el, readChartTheme())
    const offCrosshair = ctl.onCrosshairCandle(setHovered)

    // Acompanha a troca de tema do sistema (o seletor manual chega na etapa 6).
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSchemeChange = () => ctl.applyTheme(readChartTheme())
    media.addEventListener('change', onSchemeChange)

    setController(ctl)
    return () => {
      media.removeEventListener('change', onSchemeChange)
      offCrosshair()
      ctl.destroy()
      setController(null)
    }
  }, [])

  useEffect(() => {
    controller?.setCandles(`${symbol}:${interval}`, interval, candles)
  }, [controller, symbol, interval, candles])

  const legendCandle = hovered ?? candles[candles.length - 1] ?? null

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.canvas} data-testid="chart" />
      <ChartLegend symbol={symbol} interval={interval} candle={legendCandle} />
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
    </div>
  )
}
