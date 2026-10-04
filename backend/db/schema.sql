-- ==========================================================================
--  Schema do banco de dados - Decentralized Club
--  Dialeto: SQLite (Fase 1). Mapeia diretamente para PostgreSQL (Fase 4):
--    INTEGER PRIMARY KEY AUTOINCREMENT  ->  SERIAL/BIGSERIAL PRIMARY KEY
--    TEXT (datas ISO-8601)              ->  TIMESTAMPTZ
--    REAL                               ->  NUMERIC(20,8)
-- ==========================================================================

PRAGMA foreign_keys = ON;

-- Usuarios -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  name          TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Compras de criptomoedas --------------------------------------------------
CREATE TABLE IF NOT EXISTS crypto_buys (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crypto_symbol  TEXT    NOT NULL,        -- ex: BTC, ETH, SOL
  crypto_name    TEXT,                    -- ex: Bitcoin (rotulo amigavel)
  quantity       REAL    NOT NULL CHECK (quantity > 0),
  price_per_unit REAL    NOT NULL CHECK (price_per_unit >= 0), -- em USD
  total_spent    REAL    NOT NULL,        -- quantity * price_per_unit (USD)
  date_bought    TEXT    NOT NULL,        -- ISO date (YYYY-MM-DD)
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crypto_buys_user   ON crypto_buys(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_buys_symbol ON crypto_buys(user_id, crypto_symbol);

-- Renda fixa ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fixed_income (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT    NOT NULL,         -- CDB, Tesouro, Poupanca, LCI...
  description   TEXT,                      -- rotulo livre
  amount        REAL    NOT NULL CHECK (amount > 0),  -- valor investido (BRL)
  rate          REAL    NOT NULL,          -- taxa % a.a.
  date_invested TEXT    NOT NULL,          -- ISO date
  maturity_date TEXT,                      -- ISO date (vencimento)
  bank          TEXT,                      -- instituicao
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fixed_income_user ON fixed_income(user_id);

-- Outros ativos: bolsa (acoes/FIIs/ETFs/BDRs), internacional, moedas, ouro,
-- fundos, previdencia e ativos fisicos (imoveis, veiculos, gado, arte...) ---
CREATE TABLE IF NOT EXISTS assets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT    NOT NULL,   -- acao_br, fii, etf_br, bdr, acao_us, reit,
                                    -- moeda, ouro, fundo, previdencia, coe,
                                    -- imovel, terreno, veiculo, gado, arte,
                                    -- joias, negocio, consorcio, outro
  name          TEXT    NOT NULL,   -- rotulo (ex: "Apartamento Centro", "PETR4")
  ticker        TEXT,               -- para cotacao automatica (PETR4, AAPL, USD, XAU)
  quantity      REAL,               -- qtd de cotas/acoes/moedas/oncas (NULL p/ fisicos)
  invested      REAL    NOT NULL CHECK (invested >= 0), -- total investido (BRL)
  current_value REAL,               -- valor atual manual (BRL); NULL -> usa cotacao
  purchase_date TEXT,               -- ISO date
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);

-- Metas financeiras futuras ------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT    NOT NULL,          -- ex: "Aposentadoria", "Casa na praia"
  target_amount  REAL    NOT NULL CHECK (target_amount > 0),  -- em BRL
  target_date    TEXT    NOT NULL,          -- ISO date
  expected_rate  REAL    NOT NULL DEFAULT 10, -- % a.a. esperada
  initial_amount REAL    NOT NULL DEFAULT 0,  -- quanto ja tem p/ essa meta (BRL)
  notes          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- Historico de precos (para grafico de evolucao do patrimonio) -------------
CREATE TABLE IF NOT EXISTS price_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  crypto_symbol TEXT    NOT NULL,
  price         REAL    NOT NULL,          -- preco em USD
  date          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(crypto_symbol, date);

-- Diario de operacoes de cripto: planos de trade ---------------------------
-- Como este arquivo so cria tabela que nao existe, coluna nova depois do
-- primeiro deploy nao chega a producao: tudo do plano precisa caber aqui.
-- Listas de valores sao validadas na rota (Zod), sem CHECK, para que um valor
-- novo no futuro nao exija recriar a tabela:
--   market: perpetuo | spot
--   direction: compra | venda
--   status: planejado | aguardando_entrada | aberto | encerrado | cancelado
CREATE TABLE IF NOT EXISTS trade_plans (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol           TEXT    NOT NULL,          -- par da Binance, ex: MANTAUSDT
  market           TEXT    NOT NULL,          -- perpetuo | spot
  exchange         TEXT,                      -- corretora (texto livre)
  direction        TEXT    NOT NULL,          -- compra | venda
  status           TEXT    NOT NULL DEFAULT 'planejado',
  call_source      TEXT,                      -- fonte da call
  call_text        TEXT,                      -- texto original da call, colado
  thesis           TEXT,                      -- tese e confluencias
  capital_usd      REAL    NOT NULL CHECK (capital_usd > 0),   -- margem do plano (US$)
  leverage         REAL    NOT NULL DEFAULT 1 CHECK (leverage >= 1),
  structural_level REAL    CHECK (structural_level IS NULL OR structural_level > 0), -- invalidacao, separado do stop
  stop_price       REAL    CHECK (stop_price IS NULL OR stop_price > 0),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  closed_at        TEXT                       -- preenchido ao encerrar ou cancelar
);
CREATE INDEX IF NOT EXISTS idx_trade_plans_user ON trade_plans(user_id, status);

-- Niveis de cada plano: uma linha por entrada, alvo, alerta, saida ou nota.
-- kind (validado na rota):
--   entrada: zone_from, zone_to, amount_usd (margem); executed_price e event_date ao preencher
--   alvo:    zone_from, zone_to, content (descricao)
--   alerta:  price, content (opcional); so registro do alerta criado na corretora
--   saida:   price, fraction (parte da posicao, 0 a 1), event_date
--   nota:    content, event_date
-- user_id repetido aqui para toda consulta filtrar pelo dono, como no resto do banco.
CREATE TABLE IF NOT EXISTS trade_plan_levels (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id        INTEGER NOT NULL REFERENCES trade_plans(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           TEXT    NOT NULL,
  position       INTEGER NOT NULL DEFAULT 0,  -- ordem dentro do tipo
  zone_from      REAL    CHECK (zone_from IS NULL OR zone_from > 0),
  zone_to        REAL    CHECK (zone_to IS NULL OR zone_to > 0),
  amount_usd     REAL    CHECK (amount_usd IS NULL OR amount_usd > 0),
  executed_price REAL    CHECK (executed_price IS NULL OR executed_price > 0),
  price          REAL    CHECK (price IS NULL OR price > 0),
  fraction       REAL    CHECK (fraction IS NULL OR (fraction > 0 AND fraction <= 1)),
  event_date     TEXT,                        -- ISO date (YYYY-MM-DD)
  content        TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trade_plan_levels_plan ON trade_plan_levels(plan_id, kind, position);
CREATE INDEX IF NOT EXISTS idx_trade_plan_levels_user ON trade_plan_levels(user_id);
