# Pavio

App web open source de análise gráfica para criptoativos, inspirado no
TradingView e focado em Bitcoin: candles do minuto ao mensal, escala log,
indicadores em pacotes temáticos com explicação e leitura do dia, ferramentas
de desenho e watchlist em tempo real. Mostra fatos e zonas, nunca
recomendação de compra ou venda.

**Demo:** https://rayakuzaxd.github.io/Apps/

> Projeto independente. Não é afiliado à TradingView nem à Binance.

## Stack

- React 19 + TypeScript (strict) + Vite
- [Lightweight Charts™](https://github.com/tradingview/lightweight-charts) 5 (Apache-2.0)
- Zustand para estado (persistido em `localStorage`)
- Dados: API pública da Binance (REST para histórico, WebSocket para tempo real)
  e da Bitstamp (BTC/USD antes de 2017); séries macro do FRED e on-chain da
  Coin Metrics, baixadas 1× por dia pelo robô de dados
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

| Comando            | O que faz                                         |
| ------------------ | ------------------------------------------------- |
| `npm run dev`      | Servidor de desenvolvimento                       |
| `npm run build`    | Typecheck + build de produção                     |
| `npm run check`    | Typecheck, lint, formatação e testes unitários    |
| `npm run test`     | Testes unitários (Vitest)                         |
| `npm run test:e2e` | Testes end-to-end (Playwright)                    |
| `npm run data`     | Baixa as séries macro/on-chain para `public/data` |

Para usar um Chromium já instalado nos testes e2e, defina `PW_CHROMIUM_PATH`.
Caso contrário, rode `npx playwright install chromium` uma vez.

## Robô de dados

Os indicadores macro e on-chain usam séries que o navegador não consegue baixar
direto (o FRED não libera CORS). O script `scripts/fetch-data.ts` baixa tudo e
grava `public/data/<id>.json`, publicado junto com o site; o app lê esses
arquivos só quando um indicador precisa deles.

| Série          | Fonte        | Uso                             |
| -------------- | ------------ | ------------------------------- |
| `WALCL`        | FRED         | GLI (balanço do FED)            |
| `WTREGEN`      | FRED         | GLI (conta do Tesouro, TGA)     |
| `RRPONTSYD`    | FRED         | GLI (recompra reversa, RRP)     |
| `ECBASSETSW`   | FRED         | GLI (balanço do BCE)            |
| `JPNASSETS`    | FRED         | GLI (balanço do Banco do Japão) |
| `DEXUSEU`      | FRED         | GLI (câmbio US$/€)              |
| `DEXJPUS`      | FRED         | GLI (câmbio ¥/US$)              |
| `NFCI`         | FRED         | NFCI                            |
| `BTC_MVRV`     | Coin Metrics | MVRV e Preço Realizado          |
| `BTC_PRICE_CM` | Coin Metrics | Preço Realizado (preço ÷ MVRV)  |

- **Quando roda:** no CI, todo dia às 09:17 UTC e a cada push no `main`, antes
  do build. Os PRs não baixam dados (os e2e usam dados simulados). Localmente:
  `npm run data`.
- **Se uma fonte falhar:** reaproveita o arquivo já publicado no site (o de
  ontem); sem ele, a série fica sem arquivo e o app mostra "sem dado". O build
  nunca falha por causa de dados.
- **Sem número inventado:** cada série tem uma defasagem máxima (ex.: 10 dias
  para as semanais, 75 para o balanço mensal do Banco do Japão); passou disso,
  o valor vira "sem dado" em vez de repetir um dado velho.
- **Licenças:** séries do FRED (Federal Reserve Bank of St. Louis), citadas no
  rodapé; dados da Coin Metrics Community sob CC BY-NC 4.0, com atribuição no
  rodapé.

## Publicação

Cada push no `main` que passa no CI (checks, build e e2e) publica o `dist/`
no GitHub Pages pelo workflow `.github/workflows/pavio-ci.yml`. O build usa
caminhos relativos (`base: './'`), então funciona em qualquer subcaminho.

Para ativar num fork: em **Settings → Pages**, escolha **GitHub Actions** como
fonte.

## Roadmap do MVP

- [x] 0. Estrutura do projeto, ferramentas e licenças
- [x] 1. Candles com troca de par e timeframe
- [x] 2. Volume
- [x] 3. Indicadores: MME, MMS, RSI, MACD, Bandas de Bollinger
- [x] 4. Desenho: linha de tendência, linha horizontal, Fibonacci
- [x] 5. Watchlist em tempo real
- [x] 6. Tema claro/escuro

## Roadmap: ciclo e macro

- [x] 1a. Base: 1S e 1M, escala log, BTC desde 2011, pacotes de indicadores
      com explicação, tabela de zonas, painel "Leitura do dia" e layout de celular
- [x] 1b. Dados diários (FRED, Coin Metrics), Faixa de Bull Market, médias de
      50/200 semanas, MVRV, Preço Realizado, GLI e NFCI
- [ ] 2. Restante do pacote Ciclo & On-chain
- [ ] 3. Pacote Macro & Liquidez
- [ ] 4. Desenhos: retângulo, texto e fases de Wyckoff

## Como funciona

- **Tempos gráficos:** de 1 minuto a 1 mês. **1S** é a semana do calendário da
  Binance (abre segunda 00:00 UTC, domingo 21h de Brasília) e **1M** o mês do
  calendário; a última vela é a semana/mês em formação, como no TradingView.
- **BTC desde 2011:** o BTC/USDT da Binance começa em ago/2017. Em 1D, 1S e 1M,
  quando a Binance acaba, o app completa com o BTC/USD diário da Bitstamp
  (desde ago/2011), agregado em semanas e meses do calendário. A primeira
  semana/mês da Binance (parcial) é mantida no lugar da equivalente da Bitstamp.
- **Escala log:** botão `log` no canto do gráfico; ligada por padrão nos pares
  de BTC e lembrada por par. Os painéis próprios (IFR, MACD) ficam sempre em
  escala linear.
- **Histórico:** 1000 candles via `GET /api/v3/klines` ao abrir o par. Ao rolar
  para a esquerda até perto do primeiro candle (50 barras), o app busca os 1000
  anteriores (`endTime`) e os junta ao início sem mexer no zoom nem na posição.
  Para quando a Binance devolve menos que uma página (início do par) ou ao
  chegar a 20 000 candles por série, para manter leve o recálculo dos
  indicadores. Na recarga após reconexão, o histórico anterior é mantido se
  encostar nos dados novos.
- **Tempo real:** uma única conexão WebSocket combinada (`/stream`), com
  inscrições em lote (`SUBSCRIBE`/`UNSUBSCRIBE`) e reconexão com backoff
  exponencial. Após reconectar, o histórico é recarregado para cobrir lacunas.
- **Volume:** histograma sobreposto nos 20% inferiores do gráfico, em escala
  própria, com a cor do candle (alta/baixa) translúcida.
- **Pacotes de indicadores:** o menu agrupa os indicadores em **Ciclo &
  On-chain**, **Macro & Liquidez** e **Gerais**. Tocar no nome de um
  indicador na legenda mostra "o que é / como ler".
- **Leitura do dia:** painel lateral (aba ao lado da watchlist) com o preço e,
  para cada indicador ligado, o valor da vela atual e a zona em que está
  (fundo/meio/topo, acima/abaixo…), com o contexto da zona. Diz se a vela está
  em formação ou fechada. Sem dado suficiente, mostra "sem dado". As leituras
  são funções puras em `src/domain/indicators/readings.ts`, e todo corte que
  não é parâmetro do indicador fica na tabela `src/domain/indicators/zones.ts`.
  Um teste garante que nenhum texto recomenda comprar ou vender.
- **Celular:** cabeçalho em duas linhas, sem rolagem lateral; o painel lateral
  começa fechado e flutua sobre o gráfico.
- **Indicadores em semanas** (Faixa de Bull Market, médias de 50 e 200
  semanas): calculados no semanal e mostrados em qualquer tempo gráfico, em
  degraus semanais. Fora do 1S, o app baixa as semanas à parte (BTC desde 2011)
  e a semana em formação acompanha o preço ao vivo. A leitura diz como
  fecharam a última semana e o último mês.
- **Ciclo & On-chain:** Faixa de Bull Market (MMS 20s + MME 21s com a área
  pintada), médias de 50 e 200 semanas, MVRV (zonas: abaixo de 1 fundo, 1,4–1,5
  acumulação, acima de 3,5 topo) e Preço Realizado (preço ÷ MVRV). MVRV e Preço
  Realizado só existem para pares de BTC.
- **Macro & Liquidez:** GLI = balanço do FED − TGA − RRP + BCE + Banco do Japão,
  em trilhões de US$ (a China não entra), verde subindo e vermelho caindo em 28
  dias; offset em dias desloca a linha para frente e projeta além da última
  vela. NFCI colorido pela direção em 4 semanas: afrouxou 0,05 = verde, apertou
  0,05 = vermelho, entre os dois = cinza.
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
- **Watchlist:** preço e variação de 24h de cada par, com snapshot inicial via
  `/api/v3/ticker/24hr` (um pedido por par, para que um par inválido não afete
  os outros) e tempo real pelo stream `@miniTicker`, em lotes de 200 ms. Clicar
  num par abre o gráfico. A lista, a aba e a visibilidade do painel ficam salvas.
- **Erros da Binance e CORS:** as respostas de erro da Binance (ex.: 400
  "Invalid symbol") vêm sem cabeçalhos CORS, então o navegador as bloqueia e o
  app só vê uma falha de rede. Nesse caso o app consulta a lista de pares
  (`/api/v3/ticker/price`) para dizer se o par não existe ou se é problema de
  conexão.
- **Tema:** automático (segue o sistema), claro ou escuro, escolhido no
  cabeçalho e salvo no `localStorage`. As cores são variáveis CSS
  (`src/styles/tokens.css`) lidas também pelo gráfico; um script inline no
  `index.html` aplica o tema salvo antes do app carregar, para não piscar.
- **Horário:** candles intradiários são exibidos no fuso local do navegador;
  candles diários seguem o dia UTC da Binance.
- **Preferências:** par e timeframe ficam salvos no `localStorage`.

## Licença e atribuição

Código sob [MIT](./LICENSE). Os gráficos usam o TradingView Lightweight Charts™,
licenciado sob Apache-2.0. A atribuição exigida aparece no rodapé do app e em
[NOTICE](./NOTICE) e [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
