/**
 * Séries externas (macro e on-chain) baixadas 1× por dia pelo robô de dados
 * (`scripts/fetch-data.ts`, no CI) e publicadas junto com o site em `data/`.
 * Este módulo não importa nada em tempo de execução: o script roda direto no Node.
 */

/** Uma série publicada: pontos `[tempo em segundos UTC, valor]`, em ordem. */
export interface ExternalSeries {
  id: string
  title: string
  source: string
  unit: string
  /** Quantos dias um valor pode ser repetido até a próxima observação. */
  maxGapDays: number
  /** Quando o robô gerou o arquivo (ISO). */
  updatedAt: string
  points: [number, number][]
}

export type SeriesProvider =
  { kind: 'fred'; seriesId: string } | { kind: 'coinmetrics'; asset: string; metric: string }

export interface SeriesSpec {
  id: string
  title: string
  source: string
  unit: string
  maxGapDays: number
  provider: SeriesProvider
}

/** Primeiro dia baixado: o BTC tem preço desde 2010, o resto não é usado antes. */
export const DATA_START = '2010-01-01'

export const SERIES: readonly SeriesSpec[] = [
  {
    id: 'WALCL',
    title: 'Balanço do FED (ativos totais)',
    source: 'FRED',
    unit: 'milhões de US$',
    maxGapDays: 10,
    provider: { kind: 'fred', seriesId: 'WALCL' },
  },
  {
    id: 'WTREGEN',
    title: 'Conta do Tesouro no FED (TGA)',
    source: 'FRED',
    unit: 'milhões de US$',
    maxGapDays: 10,
    provider: { kind: 'fred', seriesId: 'WTREGEN' },
  },
  {
    id: 'RRPONTSYD',
    title: 'Recompra reversa (RRP)',
    source: 'FRED',
    unit: 'bilhões de US$',
    maxGapDays: 7,
    provider: { kind: 'fred', seriesId: 'RRPONTSYD' },
  },
  {
    id: 'ECBASSETSW',
    title: 'Balanço do BCE',
    source: 'FRED',
    unit: 'milhões de €',
    maxGapDays: 10,
    provider: { kind: 'fred', seriesId: 'ECBASSETSW' },
  },
  {
    id: 'JPNASSETS',
    title: 'Balanço do Banco do Japão',
    source: 'FRED',
    unit: 'centenas de milhões de ¥',
    // Mensal (dado do dia 1º): vale até o mês seguinte sair.
    maxGapDays: 75,
    provider: { kind: 'fred', seriesId: 'JPNASSETS' },
  },
  {
    id: 'DEXUSEU',
    title: 'Câmbio US$ por €',
    source: 'FRED',
    unit: 'US$/€',
    maxGapDays: 7,
    provider: { kind: 'fred', seriesId: 'DEXUSEU' },
  },
  {
    id: 'DEXJPUS',
    title: 'Câmbio ¥ por US$',
    source: 'FRED',
    unit: '¥/US$',
    maxGapDays: 7,
    provider: { kind: 'fred', seriesId: 'DEXJPUS' },
  },
  {
    id: 'NFCI',
    title: 'Condições financeiras (NFCI, FED de Chicago)',
    source: 'FRED',
    unit: 'índice',
    maxGapDays: 10,
    provider: { kind: 'fred', seriesId: 'NFCI' },
  },
  {
    id: 'BTC_MVRV',
    title: 'MVRV do Bitcoin',
    source: 'Coin Metrics',
    unit: 'razão',
    maxGapDays: 4,
    provider: { kind: 'coinmetrics', asset: 'btc', metric: 'CapMVRVCur' },
  },
  {
    id: 'BTC_PRICE_CM',
    title: 'Preço de referência do Bitcoin (Coin Metrics)',
    source: 'Coin Metrics',
    unit: 'US$',
    maxGapDays: 4,
    provider: { kind: 'coinmetrics', asset: 'btc', metric: 'PriceUSD' },
  },
]

const DAY = 86_400

/** "2026-10-21" → segundos UTC da meia-noite. */
export function dateToTime(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const ms = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(ms) ? ms / 1000 : null
}

/** CSV do FRED (`observation_date,ID`); "." e vazio são dias sem valor. */
export function parseFredCsv(csv: string, fromTime = 0): [number, number][] {
  const points: [number, number][] = []
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [date = '', raw = ''] = line.split(',')
    const time = dateToTime(date.trim())
    const value = raw.trim() === '' || raw.trim() === '.' ? Number.NaN : Number(raw)
    if (time === null || !Number.isFinite(value) || time < fromTime) continue
    points.push([time, value])
  }
  return points
}

/** Uma página da API comunitária da Coin Metrics. */
export function parseCoinMetricsPage(
  body: unknown,
  metric: string,
): { points: [number, number][]; next: string | null } {
  const page = body as { data?: Record<string, string>[]; next_page_url?: string }
  if (!Array.isArray(page?.data)) throw new Error('Coin Metrics: resposta inesperada')
  const points: [number, number][] = []
  for (const row of page.data) {
    const time = Date.parse(row.time ?? '') / 1000
    const value = Number(row[metric])
    if (Number.isFinite(time) && Number.isFinite(value))
      points.push([Math.floor(time / DAY) * DAY, value])
  }
  return { points, next: page.next_page_url ?? null }
}

/** Confere um arquivo publicado (ex.: o de ontem, usado quando a fonte falha). */
export function isExternalSeries(value: unknown, id?: string): value is ExternalSeries {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Partial<ExternalSeries>
  return (
    typeof s.id === 'string' &&
    (id === undefined || s.id === id) &&
    typeof s.maxGapDays === 'number' &&
    typeof s.updatedAt === 'string' &&
    Array.isArray(s.points) &&
    s.points.length > 0 &&
    s.points.every(
      (p, i) =>
        Array.isArray(p) &&
        p.length === 2 &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]) &&
        (i === 0 || p[0] > s.points![i - 1]![0]),
    )
  )
}
