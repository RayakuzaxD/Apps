/**
 * Robô de dados: baixa as séries macro (FRED) e on-chain (Coin Metrics) e grava
 * `public/data/<id>.json` + `public/data/index.json`. Roda no CI antes do build
 * (1× por dia e a cada push no main); localmente: `npm run data`.
 *
 * Se uma fonte falhar, reaproveita o arquivo já publicado no site (o de ontem);
 * se nem isso existir, a série fica sem arquivo e o app mostra "sem dado".
 * Nunca falha o build por causa de dados.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DATA_START,
  SERIES,
  dateToTime,
  isExternalSeries,
  parseCoinMetricsPage,
  parseFredCsv,
  type ExternalSeries,
  type SeriesSpec,
} from '../src/data/series.ts'

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'data')
const PUBLISHED = (process.env.DATA_FALLBACK_URL ?? 'https://rayakuzaxd.github.io/Apps').replace(
  /\/+$/,
  '',
)
const TIMEOUT_MS = 60_000
// O FRED recusa (503) o User-Agent padrão do Node; identifica o projeto.
const USER_AGENT = 'Mozilla/5.0 (compatible; pavio-data/1.0; +https://github.com/RayakuzaxD/Apps)'

async function get(url: string): Promise<Response> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`)
  return res
}

async function fetchPoints(spec: SeriesSpec): Promise<[number, number][]> {
  const from = dateToTime(DATA_START)!
  const { provider } = spec
  if (provider.kind === 'fred') {
    const csv = await (
      await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${provider.seriesId}`)
    ).text()
    return parseFredCsv(csv, from)
  }
  const params = new URLSearchParams({
    assets: provider.asset,
    metrics: provider.metric,
    frequency: '1d',
    start_time: DATA_START,
    page_size: '10000',
  })
  let url: string | null =
    `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?${params.toString()}`
  const points: [number, number][] = []
  for (let page = 0; url && page < 10; page++) {
    const parsed = parseCoinMetricsPage(await (await get(url)).json(), provider.metric)
    points.push(...parsed.points)
    url = parsed.next
  }
  return points
}

type Outcome = 'atualizado' | 'reaproveitado' | 'sem dado'

async function build(
  spec: SeriesSpec,
): Promise<{ series: ExternalSeries | null; outcome: Outcome; error?: string }> {
  try {
    const points = await fetchPoints(spec)
    const series: ExternalSeries = {
      id: spec.id,
      title: spec.title,
      source: spec.source,
      unit: spec.unit,
      maxGapDays: spec.maxGapDays,
      updatedAt: new Date().toISOString(),
      points,
    }
    if (!isExternalSeries(series, spec.id)) throw new Error('série vazia ou fora de ordem')
    return { series, outcome: 'atualizado' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      const old: unknown = await (await get(`${PUBLISHED}/data/${spec.id}.json`)).json()
      if (isExternalSeries(old, spec.id))
        return { series: old, outcome: 'reaproveitado', error: message }
    } catch {
      // Sem arquivo publicado: segue sem dado.
    }
    return { series: null, outcome: 'sem dado', error: message }
  }
}

await mkdir(OUT_DIR, { recursive: true })
const index: Record<string, { outcome: Outcome; updatedAt: string | null; last: string | null }> =
  {}
for (const spec of SERIES) {
  const { series, outcome, error } = await build(spec)
  if (series) await writeFile(join(OUT_DIR, `${spec.id}.json`), JSON.stringify(series))
  const lastTime = series?.points.at(-1)?.[0]
  index[spec.id] = {
    outcome,
    updatedAt: series?.updatedAt ?? null,
    last: lastTime === undefined ? null : new Date(lastTime * 1000).toISOString().slice(0, 10),
  }
  const detail = error ? ` (${error})` : ''
  console.log(
    `${spec.id}: ${outcome}${series ? `, ${series.points.length} pontos até ${index[spec.id]!.last}` : ''}${detail}`,
  )
}
await writeFile(
  join(OUT_DIR, 'index.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), series: index }, null, 1),
)
