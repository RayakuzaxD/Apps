import { TickMarkType } from 'lightweight-charts'
import type { TimeDetail } from '../domain/intervals'

/**
 * O Lightweight Charts trabalha em UTC. Para exibir o horário local, os
 * timestamps intradiários são deslocados pelo fuso do usuário e formatados
 * como UTC (abordagem recomendada pela documentação da biblioteca).
 * Candles diários não são deslocados: o dia do candle é o dia UTC da Binance.
 *
 * Usa um deslocamento fixo (o atual) para a série inteira, garantindo tempos
 * sempre crescentes mesmo em trocas de horário de verão.
 */
export function localOffsetSeconds(date = new Date()): number {
  return -date.getTimezoneOffset() * 60
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const pad = (n: number) => String(n).padStart(2, '0')

function parts(time: number) {
  const d = new Date(time * 1000)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
  }
}

/** Rótulos do eixo de tempo (recebe tempos já deslocados). */
export function formatTickMark(time: number, type: TickMarkType): string {
  const p = parts(time)
  switch (type) {
    case TickMarkType.Year:
      return String(p.year)
    case TickMarkType.Month:
      return MONTHS[p.month]!
    case TickMarkType.DayOfMonth:
      return String(p.day)
    case TickMarkType.Time:
      return `${pad(p.hours)}:${pad(p.minutes)}`
    case TickMarkType.TimeWithSeconds:
      return `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`
  }
}

/** Rótulo do crosshair (recebe tempos já deslocados). */
export function formatCrosshairTime(time: number, detail: TimeDetail): string {
  const p = parts(time)
  if (detail === 'month') return `${MONTHS[p.month]} ${p.year}`
  const date = `${WEEKDAYS[p.weekday]} ${pad(p.day)} ${MONTHS[p.month]} ${String(p.year).slice(2)}`
  return detail === 'intraday' ? `${date}  ${pad(p.hours)}:${pad(p.minutes)}` : date
}
