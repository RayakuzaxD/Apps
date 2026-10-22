export const POPULAR_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'DOTUSDT',
  'LTCUSDT',
  'TRXUSDT',
] as const

export const DEFAULT_SYMBOL = 'BTCUSDT'

// Ordem importa: sufixos mais longos primeiro (FDUSD antes de USD...).
const QUOTE_ASSETS = ['FDUSD', 'USDT', 'USDC', 'TUSD', 'BTC', 'ETH', 'BNB', 'BRL', 'EUR', 'TRY']

export function normalizeSymbol(input: string): string {
  return input.replace(/[^a-z0-9]/gi, '').toUpperCase()
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{5,20}$/.test(symbol)
}

/** "BTCUSDT" -> { base: "BTC", quote: "USDT" }. Sem quote conhecida, quote fica vazia. */
export function splitSymbol(symbol: string): { base: string; quote: string } {
  const quote = QUOTE_ASSETS.find((q) => symbol.endsWith(q) && symbol.length > q.length)
  return quote ? { base: symbol.slice(0, -quote.length), quote } : { base: symbol, quote: '' }
}

export function formatSymbol(symbol: string): string {
  const { base, quote } = splitSymbol(symbol)
  return quote ? `${base}/${quote}` : base
}
