import { BinanceApiError } from './rest'

/** Mensagem amigável (pt-BR) para falhas ao carregar dados. */
export function describeLoadError(error: unknown, symbol: string): string {
  if (error instanceof BinanceApiError) {
    if (error.code === -1121) return `O par ${symbol} não existe na Binance.`
    if (error.status === 451 || error.status === 403) {
      return 'A Binance bloqueou o acesso a partir desta região. Configure outro endpoint em VITE_BINANCE_REST_URL.'
    }
    if (error.status === 429 || error.status === 418) {
      return 'Limite de requisições da Binance atingido. Aguarde um pouco e tente de novo.'
    }
    return `A Binance respondeu com erro: ${error.message}`
  }
  return 'Não foi possível carregar os dados. Verifique sua conexão.'
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
