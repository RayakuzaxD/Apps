import type { Candle } from '../domain/types'

/** Fração da altura do painel principal ocupada pelo volume (faixa inferior). */
export const VOLUME_HEIGHT = 0.2

/** Margens da escala de preço dos candles, deixando espaço para o volume embaixo. */
export const CANDLE_SCALE_MARGINS = { top: 0.1, bottom: VOLUME_HEIGHT + 0.05 }
export const VOLUME_SCALE_MARGINS = { top: 1 - VOLUME_HEIGHT, bottom: 0 }

const VOLUME_ALPHA = 0.45

/** Aplica transparência a uma cor hex (#rgb ou #rrggbb). Outros formatos voltam inalterados. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/, '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return color
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return `#${full.toLowerCase()}${a.toString(16).padStart(2, '0')}`
}

export interface VolumeColors {
  up: string
  down: string
}

export function volumeColors(theme: { up: string; down: string }): VolumeColors {
  return { up: withAlpha(theme.up, VOLUME_ALPHA), down: withAlpha(theme.down, VOLUME_ALPHA) }
}

/** Cor da barra de volume segue o candle: alta (fechamento >= abertura) ou baixa. */
export function volumeColor(candle: Candle, colors: VolumeColors): string {
  return candle.close >= candle.open ? colors.up : colors.down
}
