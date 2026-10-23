import { periodEnd, pricePrecision } from '../../domain/candles'
import { formatPercent, formatPrice } from '../../domain/format'
import {
  indicatorLabel,
  readIndicator,
  type ComputeContext,
  type IndicatorResult,
} from '../../domain/indicators/registry'
import { getInterval, isIntraday } from '../../domain/intervals'
import { splitSymbol } from '../../domain/symbols'
import type { Candle, IntervalId } from '../../domain/types'
import type { KlinesStatus } from '../../hooks/useKlines'
import { useNow } from '../../hooks/useNow'
import styles from './Panel.module.css'
import { periodPhrases } from './periodPhrases'

interface ReadingPanelProps {
  symbol: string
  interval: IntervalId
  candles: readonly Candle[]
  results: readonly IndicatorResult[]
  status: KlinesStatus
  /** Contexto dos indicadores (velas semanais/mensais, séries externas). */
  data?: ComputeContext
  /** Agora, em segundos (injetável nos testes). */
  now?: number
}

function candleDate(time: number, interval: IntervalId): string {
  const date = new Date(time * 1000)
  if (interval === '1M') {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  if (!isIntraday(interval)) return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * "Leitura do dia": para cada indicador ligado, o valor no candle atual e a
 * zona em que está. Só fatos e zonas, nunca recomendação.
 */
export function ReadingPanel({
  symbol,
  interval,
  candles,
  results,
  status,
  data,
  now,
}: ReadingPanelProps) {
  const clock = useNow()
  const nowSec = now ?? clock
  const last = candles[candles.length - 1]
  const { base, quote } = splitSymbol(symbol)
  const pair = quote ? `${base}/${quote}` : base
  const def = getInterval(interval)
  const forming =
    last !== undefined && nowSec < periodEnd(last.time, def.seconds, interval === '1M')
  const phrases = periodPhrases(interval, forming)
  const visible = results.filter((r) => r.config.visible)

  if (status !== 'ready' || !last) {
    return (
      <section className={styles.reading} aria-label="Leitura do dia">
        <p className={styles.empty}>{status === 'loading' ? 'Carregando dados…' : 'Sem dado.'}</p>
      </section>
    )
  }

  const precision = pricePrecision(last.close)
  const change = last.open === 0 ? 0 : (last.close - last.open) / last.open

  return (
    <section className={styles.reading} aria-label="Leitura do dia">
      <header className={styles.readingHeader}>
        <p className={styles.readingTitle}>
          {pair} · {def.label}
        </p>
        <p className={styles.readingMeta} data-testid="reading-period">
          {phrases.status} · {candleDate(last.time, interval)}
        </p>
      </header>

      <dl className={styles.readingList}>
        <div className={styles.readingItem} data-testid="reading-price">
          <dt className={styles.readingName}>Preço</dt>
          <dd className={styles.readingValue}>
            {formatPrice(last.close, precision)}{' '}
            <span data-sign={change >= 0 ? 'up' : 'down'} className={styles.change}>
              {formatPercent(change)}
            </span>
          </dd>
          <dd className={styles.readingDetail}>{phrases.sinceOpen}</dd>
        </div>

        {visible.map((result) => {
          const label = indicatorLabel(result.config.type, result.config.params)
          const reading = readIndicator(result, candles, precision, candles.length - 1, data)
          return (
            <div
              key={result.config.id}
              className={styles.readingItem}
              data-testid={`reading-${result.config.type}`}
            >
              <dt className={styles.readingName}>{label}</dt>
              {reading ? (
                <>
                  <dd className={styles.readingValue}>
                    {reading.value}{' '}
                    <span className={styles.zone} data-tone={reading.tone}>
                      {reading.zone}
                    </span>
                  </dd>
                  <dd className={styles.readingDetail}>{reading.detail}</dd>
                </>
              ) : (
                <dd className={styles.readingValue}>
                  <span className={styles.zone} data-tone="neutral">
                    sem dado
                  </span>
                </dd>
              )}
            </div>
          )
        })}
      </dl>

      {visible.length === 0 && (
        <p className={styles.empty}>
          Nenhum indicador ligado. Adicione em <strong>Indicadores</strong> para ver a leitura de
          cada um aqui.
        </p>
      )}

      <p className={styles.disclaimer}>
        Valores e zonas {phrases.scope}. Mostra fatos e o que costuma acontecer em cada zona; não é
        recomendação.
      </p>
    </section>
  )
}
