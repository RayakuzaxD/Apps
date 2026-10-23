import { describe, expect, it } from 'vitest'
import {
  SERIES,
  dateToTime,
  isExternalSeries,
  parseCoinMetricsPage,
  parseFredCsv,
  type ExternalSeries,
} from './series'

describe('séries externas', () => {
  it('catálogo com ids únicos e defasagem máxima positiva', () => {
    const ids = SERIES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SERIES) expect(s.maxGapDays, s.id).toBeGreaterThan(0)
  })

  it('data do FRED vira meia-noite UTC; formato inválido vira null', () => {
    expect(dateToTime('2026-10-21')).toBe(Date.UTC(2026, 9, 21) / 1000)
    expect(dateToTime('21/10/2026')).toBeNull()
  })

  it('lê o CSV do FRED pulando dias sem valor e datas antes do início', () => {
    const csv = [
      'observation_date,NFCI',
      '2009-12-25,0.1',
      '2010-01-01,-0.25',
      '2010-01-08,.',
      '2010-01-15,',
      '2010-01-22,0.5\r',
    ].join('\n')
    expect(parseFredCsv(csv, dateToTime('2010-01-01')!)).toEqual([
      [dateToTime('2010-01-01'), -0.25],
      [dateToTime('2010-01-22'), 0.5],
    ])
  })

  it('lê a página da Coin Metrics (data com nanossegundos) e a próxima página', () => {
    const body = {
      data: [
        { asset: 'btc', time: '2026-10-20T00:00:00.000000000Z', CapMVRVCur: '1.55' },
        { asset: 'btc', time: '2026-10-21T00:00:00.000000000Z', CapMVRVCur: 'x' },
      ],
      next_page_url: 'https://api.test/next',
    }
    expect(parseCoinMetricsPage(body, 'CapMVRVCur')).toEqual({
      points: [[dateToTime('2026-10-20'), 1.55]],
      next: 'https://api.test/next',
    })
    expect(parseCoinMetricsPage({ data: [] }, 'X').next).toBeNull()
    expect(() => parseCoinMetricsPage({ error: 'forbidden' }, 'X')).toThrow('resposta inesperada')
  })

  it('valida um arquivo publicado: id, pontos finitos e em ordem', () => {
    const ok: ExternalSeries = {
      id: 'NFCI',
      title: 't',
      source: 'FRED',
      unit: 'índice',
      maxGapDays: 10,
      updatedAt: '2026-10-22T06:00:00Z',
      points: [
        [1, 0.1],
        [2, 0.2],
      ],
    }
    expect(isExternalSeries(ok, 'NFCI')).toBe(true)
    expect(isExternalSeries(ok, 'WALCL')).toBe(false)
    expect(isExternalSeries({ ...ok, points: [] })).toBe(false)
    expect(
      isExternalSeries({
        ...ok,
        points: [
          [2, 1],
          [1, 1],
        ],
      }),
    ).toBe(false)
    expect(isExternalSeries({ ...ok, points: [[1, Number.NaN]] })).toBe(false)
    expect(isExternalSeries(null)).toBe(false)
  })
})
