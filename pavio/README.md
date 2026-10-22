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
- [x] 1. Candles com troca de par e timeframe
- [x] 2. Volume
- [x] 3. Indicadores: MME, MMS, RSI, MACD, Bandas de Bollinger
- [x] 4. Desenho: linha de tendência, linha horizontal, Fibonacci
- [ ] 5. Watchlist em tempo real
- [ ] 6. Tema claro/escuro

## Como funciona

- **Histórico:** até 1000 candles via `GET /api/v3/klines`.
- **Tempo real:** uma única conexão WebSocket combinada (`/stream`), com
  inscrições em lote (`SUBSCRIBE`/`UNSUBSCRIBE`) e reconexão com backoff
  exponencial. Após reconectar, o histórico é recarregado para cobrir lacunas.
- **Volume:** histograma sobreposto nos 20% inferiores do gráfico, em escala
  própria, com a cor do candle (alta/baixa) translúcida.
- **Indicadores:** MME, MMS e Bandas de Bollinger sobre os candles; IFR (RSI)
  e MACD em painéis próprios. Cada instância tem período, fonte de preço e
  cores editáveis e fica salva no `localStorage`. Os cálculos ficam em
  `src/domain/indicators` como funções puras: médias exponenciais semeadas pela
  média simples, IFR com suavização de Wilder e Bollinger com desvio padrão
  populacional.
- **Desenhos:** linha de tendência, linha horizontal e retração de Fibonacci,
  desenhadas por uma primitiva do Lightweight Charts (`src/drawings`). Cada
  ponto é ancorado em tempo real e preço, então o desenho sobrevive à troca de
  timeframe. No modo cursor, clicar seleciona e arrastar move o desenho ou uma
  alça; Delete remove e Esc cancela. Os desenhos são guardados por par no
  `localStorage`.
- **Horário:** candles intradiários são exibidos no fuso local do navegador;
  candles diários seguem o dia UTC da Binance.
- **Preferências:** par e timeframe ficam salvos no `localStorage`.

## Licença e atribuição

Código sob [MIT](./LICENSE). Os gráficos usam o TradingView Lightweight Charts™,
licenciado sob Apache-2.0. A atribuição exigida aparece no rodapé do app e em
[NOTICE](./NOTICE) e [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
