import styles from './Footer.module.css'

/**
 * Rodapé com a atribuição exigida pela licença do Lightweight Charts
 * (NOTICE + link para tradingview.com visível ao usuário).
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>
        Gráficos:{' '}
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">
          TradingView Lightweight Charts™
        </a>{' '}
        · Copyright (c) 2025 TradingView, Inc.
      </span>
      <span>Dados de mercado: Binance · BTC antes de 2017: Bitstamp</span>
    </footer>
  )
}
