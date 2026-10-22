/**
 * Conversão entre tempo real (segundos UTC) e posição lógica (índice de barra,
 * fracionário) numa série de candles. Fora dos dados, extrapola pelo intervalo;
 * entre duas barras, interpola. Assim desenhos sobrevivem à troca de timeframe
 * e podem ficar na área vazia à direita do último candle.
 */
export function timeToLogical(
  times: readonly number[],
  intervalSec: number,
  time: number,
): number | null {
  const n = times.length
  if (n === 0) return null
  const first = times[0]!
  const last = times[n - 1]!
  if (time <= first) return (time - first) / intervalSec
  if (time >= last) return n - 1 + (time - last) / intervalSec

  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (times[mid]! <= time) lo = mid
    else hi = mid
  }
  const t0 = times[lo]!
  const t1 = times[hi]!
  return lo + (time - t0) / (t1 - t0)
}

export function logicalToTime(
  times: readonly number[],
  intervalSec: number,
  logical: number,
): number | null {
  const n = times.length
  if (n === 0) return null
  if (logical <= 0) return times[0]! + logical * intervalSec
  if (logical >= n - 1) return times[n - 1]! + (logical - (n - 1)) * intervalSec
  const i = Math.floor(logical)
  const t0 = times[i]!
  const t1 = times[i + 1]!
  return t0 + (logical - i) * (t1 - t0)
}
