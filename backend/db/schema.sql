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

-- Historico de precos (para grafico de evolucao do patrimonio) -------------
CREATE TABLE IF NOT EXISTS price_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  crypto_symbol TEXT    NOT NULL,
  price         REAL    NOT NULL,          -- preco em USD
  date          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(crypto_symbol, date);
