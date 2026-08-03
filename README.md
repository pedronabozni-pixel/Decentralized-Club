# NBZ Wealth — Plataforma de Gestão de Patrimônio

Plataforma web para gestão de carteira de investimentos (**criptomoedas + renda fixa**)
com dados de mercado em tempo real, cálculo automático de preço médio, ganho/perda,
distribuição da carteira, simulador de juros e dashboards.

Sistema visual NBZ Wealth: dark mode permanente, preto `#0A0A0A`, off-white `#F5F5F0`,
champagne `#C9A961` como traço, bruma `#97928A` e linha `#1F1F1D`. Só reta, sem cantos
arredondados. Cormorant Garamond 300 no valor, IBM Plex Mono no rótulo, Inter no dado.

---

## ✨ Funcionalidades (Fase 1 — MVP)

- **Autenticação** com JWT + bcrypt (registro e login).
- **Dashboard geral**: patrimônio total, ganho/perda do dia e total, distribuição
  (Bitcoin / Altcoins / Renda Fixa), evolução do patrimônio (7/30/90 dias) e
  comparativo cripto × renda fixa.
- **Criptomoedas** (valores em **US$**, moeda nativa do mercado): lista de posições
  com **preço médio calculado automaticamente**, preço atual, variação 24h,
  ganho/perda em US$ e %; cadastro de compras (preço pago em US$) com
  **autocomplete de moedas**; histórico por moeda; gráfico de performance.
  O dashboard consolida cripto + renda fixa em **R$** pela cotação do dólar ao vivo.
- **Renda fixa**: cadastro (CDB, RDB, Tesouro, Poupança, LCI/LCA, LC, LF, CRI,
  CRA, Debêntures — com isenção de IR aplicada automaticamente aos isentos),
  dashboard de rendimento acumulado e projetado.
- **Ativos (todas as classes do Brasil)**: Ações B3, FIIs, ETFs, BDRs — cotação
  automática via Yahoo Finance; Ações internacionais, REITs e ETFs EUA —
  cotação em USD convertida pelo dólar ao vivo; Moedas estrangeiras e Ouro
  (XAU) via AwesomeAPI; Fundos, Previdência (PGBL/VGBL) e COE com valor
  manual; Físicos: imóveis, terrenos, veículos, gado/agro, arte, joias,
  participação em negócios e consórcios (valor atualizável a qualquer momento).
- **Simulador de juros**: valor + taxa + período → bruto, IR (tabela regressiva),
  líquido e total.
- **Integrações de mercado em tempo real**:
  - [CoinGecko](https://www.coingecko.com/api) — preços (BRL/USD), market cap,
    dominância BTC, histórico (grátis, sem chave).
  - [Binance](https://binance-docs.github.io/apidocs/spot/en/) — preço spot público
    **+ WebSocket ao vivo** (`stream.binance.com`): preços, valores e ganho/perda
    atualizam na tela a cada segundo, sem recarregar (badge "ao vivo").
  - [AwesomeAPI](https://economia.awesomeapi.com.br) — cotação USD/BRL.
  - [Banco Central (SGS)](https://www.bcb.gov.br/estatisticas/sgs) — taxa SELIC.
  - [CoinMarketCap](https://coinmarketcap.com/api/) — opcional
    (`COINMARKETCAP_API_KEY` no `.env`), usada como fallback.
- **Fallback multi-fonte** (`backend/services/prices.js`): CoinGecko → Binance ×
  dólar → CoinMarketCap. Se uma fonte cair, o dashboard continua funcionando.

---

## 🧱 Stack

| Camada    | Tecnologia |
|-----------|------------|
| Frontend  | HTML5 + CSS3 + JavaScript (vanilla, modular) · Chart.js |
| Backend   | Node.js + Express |
| Banco     | **SQLite** (Fase 1, embarcado) → **PostgreSQL** (Fase 4, Railway) |
| Cache     | Em memória (Fase 1) → Redis (opcional, Fase 4) |
| Auth      | JWT + bcrypt · validação com Zod |

> **Por que SQLite no MVP?** Zero instalação — a plataforma roda com apenas
> `npm install && npm start`, sem depender de Postgres/Docker/Redis na máquina.
> Toda a camada de acesso a dados está isolada em `backend/repositories/`, e o
> schema (`backend/db/schema.sql`) mapeia 1:1 para PostgreSQL, tornando a
> migração para o Railway (Fase 4) uma troca contida.

---

## 🚀 Setup

Pré-requisito: **Node.js 18+** (testado no Node 24).

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
#    (opcional) gere um JWT_SECRET forte:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
#    e cole em JWT_SECRET no arquivo .env

# 3. Criar as tabelas do banco
npm run migrate

# 4. (Opcional) Popular com dados de demonstração
npm run seed
#    Login demo:  demo@decentralized.club  |  Senha: demo12345

# 5. Subir o servidor
npm start
```

Acesse **http://localhost:3010** (porta configurável via `PORT` no `.env`).
O backend serve a API (`/api/*`) e o frontend estático.

Para desenvolvimento com auto-reload:

```bash
npm run dev
```

---

## 📂 Estrutura

```
nbz-wealth/
├── backend/
│   ├── server.js              # Express: API + frontend estático
│   ├── config.js              # Configuração central (.env)
│   ├── db/
│   │   ├── index.js           # Conexão SQLite + migrações
│   │   ├── schema.sql         # Schema (portável p/ PostgreSQL)
│   │   ├── migrate.js         # `npm run migrate`
│   │   └── seed.js            # `npm run seed`
│   ├── repositories/          # Acesso a dados (users, cryptoBuys, fixedIncome…)
│   ├── routes/                # auth, crypto, fixed-income, portfolio, market
│   ├── services/              # coingecko, binance, dollar, bcb, calculations, cache
│   └── middleware/            # auth (JWT), errorHandler (+ validação Zod)
├── frontend/
│   ├── index.html             # Login / registro
│   ├── pages/                 # dashboard, criptomoedas, renda-fixa, simulador
│   ├── css/                   # styles.css (design system), charts.css
│   └── js/                    # api-client, app, charts, dashboard, crypto-manager…
├── data/                      # banco SQLite (gerado; ignorado pelo git)
├── .env.example
├── .gitignore
└── package.json
```

---

## 🔌 API (resumo)

Todas as rotas (exceto `/api/auth/*` e `/api/health`) exigem header
`Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST   | `/api/auth/register` | Cria conta, retorna `{ token, user }` |
| POST   | `/api/auth/login` | Login |
| GET    | `/api/portfolio/summary` | Dashboard consolidado |
| GET    | `/api/portfolio/evolution?days=30` | Série de evolução do patrimônio |
| GET    | `/api/crypto/positions` | Posições com preço médio e ganho/perda |
| GET    | `/api/crypto/search?q=` | Autocomplete de moedas |
| GET/POST/DELETE | `/api/crypto/buys` | CRUD de compras |
| GET/POST/DELETE | `/api/fixed-income` | CRUD de renda fixa + dashboard |
| POST   | `/api/fixed-income/simulate` | Simulador de juros |
| GET    | `/api/market/prices?symbols=BTC,ETH` | Preços ao vivo |
| GET    | `/api/market/dollar` · `/global` · `/history/:symbol` | Dados de mercado |

---

## 🔐 Segurança

- Senhas com **bcrypt** (cost 12). Autenticação **JWT**.
- **Validação de inputs** com Zod em todas as rotas de escrita.
- Segredos em **variáveis de ambiente** (`.env`), nunca no código.
- `.gitignore` protege `.env` e o arquivo do banco.

---

## 🗺️ Próximas fases

- **Fase 2** — WebSocket de preços em tempo real (Binance), gráficos avançados.
- **Fase 3** — Alertas, relatórios/exportação (CSV/PDF), sugestões inteligentes.
- **Fase 4** — Deploy no Railway: trocar SQLite → PostgreSQL (`DATABASE_URL`),
  cache → Redis (`REDIS_URL`), domínio + HTTPS + backup.

### Migração para PostgreSQL (Fase 4)

1. Provisionar PostgreSQL no Railway e definir `DATABASE_URL`.
2. Adaptar `backend/db/index.js` para o driver `pg` (o schema em
   `schema.sql` já é compatível — ver comentários de tipos no topo do arquivo).
3. Os `repositories/` mantêm a mesma interface; a troca fica contida nessa camada.
