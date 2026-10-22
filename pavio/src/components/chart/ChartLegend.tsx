import { pricePrecision } from '../../domain/candles'
import { formatPercent, formatPrice, formatVolume } from '../../domain/format'
import { getInterval } from '../../domain/intervals'
import { formatSymbol } from '../../domain/symbols'
import type { Candle, IntervalId } from '../../domain/types'
import styles from './ChartView.module.css'

interface ChartLegendProps {
  symbol: string
  interval: IntervalId
  candle: Candle | null
}

export function ChartLegend({ symbol, interval, candle }: ChartLegendProps) {
  const dir = candle && candle.close < candle.open ? 'down' : 'up'
  const precision = candle ? pricePrecision(candle.close) : 2
  const fmt = (v: number) => formatPrice(v, precision)

  return (
    <div className={styles.legend} data-testid="chart-legend">
      <span className={styles.title}>{formatSymbol(symbol)}</span>
      <span className={styles.meta}>{getInterval(interval).label} · Binance</span>
      {candle && (
        <>
          {(
            [
              ['A', candle.open],
              ['M', candle.high],
              ['m', candle.low],
              ['F', candle.close],
            ] as const
          ).map(([label, value]) => (
            <span key={label}>
              <span className={styles.label}>{label}</span>
              <span className={styles.value} data-dir={dir} data-testid={`legend-${label}`}>
                {fmt(value)}
              </span>
            </span>
          ))}
          <span className={styles.value} data-dir={dir} data-testid="legend-change">
            {formatPercent(candle.open === 0 ? 0 : (candle.close - candle.open) / candle.open)}
          </span>
          <span>
            <span className={styles.label}>Vol</span>
            <span data-testid="legend-volume">{formatVolume(candle.volume)}</span>
          </span>
        </>
      )}
    </div>
  )
}
