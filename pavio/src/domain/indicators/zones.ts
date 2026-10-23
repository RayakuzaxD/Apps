/**
 * Tabela de zonas e cortes usados nas leituras ("Leitura do dia").
 * Todo número que classifica um valor em zona fica aqui, num só lugar, para
 * poder ser revisto sem caçar constantes pelo código. Cortes que o usuário
 * edita por indicador (ex.: 70/30 do IFR) ficam nos parâmetros do indicador.
 */
export const ZONES = {
  bollinger: {
    /** Velas usadas para comparar a largura atual das bandas. */
    widthLookback: 120,
    /** Largura entre as X% menores do período = bandas estreitas. */
    narrowPercentile: 20,
    /** Largura entre as X% maiores do período = bandas largas. */
    widePercentile: 80,
  },
  mvrv: {
    /** Abaixo disso: zona de fundo. */
    bottom: 1,
    /** Faixa de acumulação. */
    accumulationLow: 1.4,
    accumulationHigh: 1.5,
    /** Acima disso: zona de topo. */
    top: 3.5,
  },
  gli: {
    /** Janela para dizer se a liquidez está subindo ou caindo. */
    lookbackDays: 28,
  },
  nfci: {
    /** Direção do NFCI em N semanas: afrouxou ou apertou pelo menos o limiar. */
    lookbackWeeks: 4,
    threshold: 0.05,
  },
} as const

export type ZonesTable = typeof ZONES
