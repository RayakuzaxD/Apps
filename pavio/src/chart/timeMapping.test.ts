import { describe, expect, it } from 'vitest'
import { logicalToTime, timeToLogical } from './timeMapping'

const H = 3600
const times = [0, H, 2 * H, 3 * H, 4 * H]

describe('timeToLogical', () => {
  it('tempo exato de uma barra vira o índice', () => {
    expect(timeToLogical(times, H, 2 * H)).toBe(2)
  })

  it('interpola entre barras (ex.: ponto de 1m visto no 1h)', () => {
    expect(timeToLogical(times, H, 2 * H + 15 * 60)).toBe(2.25)
  })

  it('extrapola à direita e à esquerda pelo intervalo', () => {
    expect(timeToLogical(times, H, 7 * H)).toBe(7)
    expect(timeToLogical(times, H, -2 * H)).toBe(-2)
  })

  it('lida com lacunas nos dados', () => {
    expect(timeToLogical([0, H, 10 * H], H, 5.5 * H)).toBe(1.5)
  })

  it('série vazia', () => {
    expect(timeToLogical([], H, 0)).toBeNull()
  })
})

describe('logicalToTime', () => {
  it('é o inverso de timeToLogical', () => {
    for (const t of [-3 * H, 0, 1.5 * H, 4 * H, 9 * H]) {
      expect(logicalToTime(times, H, timeToLogical(times, H, t)!)).toBeCloseTo(t, 6)
    }
  })

  it('índice inteiro devolve o tempo da barra', () => {
    expect(logicalToTime(times, H, 3)).toBe(3 * H)
  })

  it('série vazia', () => {
    expect(logicalToTime([], H, 1)).toBeNull()
  })
})
