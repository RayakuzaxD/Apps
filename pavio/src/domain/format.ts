const priceFormatters = new Map<number, Intl.NumberFormat>()

export function formatPrice(value: number, precision: number): string {
  let fmt = priceFormatters.get(precision)
  if (!fmt) {
    fmt = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    })
    priceFormatters.set(precision, fmt)
  }
  return fmt.format(value)
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 2 })

export function formatVolume(value: number): string {
  return compact.format(value)
}

const percent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

/** `ratio` em fração: 0.0123 -> "+1,23%". */
export function formatPercent(ratio: number): string {
  return percent.format(ratio)
}
