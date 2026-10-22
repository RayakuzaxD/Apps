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
} as const

export type ZonesTable = typeof ZONES
