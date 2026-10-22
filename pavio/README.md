# Pavio

App web open source de análise gráfica para criptoativos: candles, volume,
indicadores, ferramentas de desenho e watchlist em tempo real.

> Projeto independente. Não é afiliado à TradingView nem à Binance.

## Stack

- React 19 + TypeScript (strict) + Vite
- [Lightweight Charts™](https://github.com/tradingview/lightweight-charts) 5 (Apache-2.0)
- Zustand para estado (persistido em `localStorage`)
- Dados: API pública da Binance (REST para histórico, WebSocket para tempo real)
- Testes: Vitest + Testing Library (unidade/componentes) e Playwright (e2e)

## Rodando localmente

Requer Node.js 20.19+.

```bash
npm install
cp .env.example .env   # opcional
npm run dev
```

### Endpoints da Binance

Por padrão o app usa o espelho público de market data `binance.vision`
(`https://data-api.binance.vision` e `wss://data-stream.binance.vision`), que
funciona em regiões onde `api.binance.com` é bloqueado. Para trocar, defina
`VITE_BINANCE_REST_URL` e `VITE_BINANCE_WS_URL` no `.env`.

## Scripts

| Comando            | O que faz                                      |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Servidor de desenvolvimento                    |
| `npm run build`    | Typecheck + build de produção                  |
| `npm run check`    | Typecheck, lint, formatação e testes unitários |
| `npm run test`     | Testes unitários (Vitest)                      |
| `npm run test:e2e` | Testes end-to-end (Playwright)                 |

Para usar um Chromium já instalado nos testes e2e, defina `PW_CHROMIUM_PATH`.
Caso contrário, rode `npx playwright install chromium` uma vez.

## Roadmap do MVP

- [x] 0. Estrutura do projeto, ferramentas e licenças
- [ ] 1. Candles com troca de par e timeframe
- [ ] 2. Volume
- [ ] 3. Indicadores: MME, MMS, RSI, MACD, Bandas de Bollinger
- [ ] 4. Desenho: linha de tendência, linha horizontal, Fibonacci
- [ ] 5. Watchlist em tempo real
- [ ] 6. Tema claro/escuro

## Licença e atribuição

Código sob [MIT](./LICENSE). Os gráficos usam o TradingView Lightweight Charts™,
licenciado sob Apache-2.0. A atribuição exigida aparece no rodapé do app e em
[NOTICE](./NOTICE) e [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
