// ==========================================================================
//  Configuracao central da aplicacao.
//  Le variaveis de ambiente (.env) e expoe valores tipados/normalizados.
// ==========================================================================
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3010,

  // Caminho absoluto do arquivo SQLite (Fase 1).
  sqlitePath: path.isAbsolute(process.env.SQLITE_PATH || '')
    ? process.env.SQLITE_PATH
    : path.join(ROOT, process.env.SQLITE_PATH || 'data/decentralized.db'),

  // String de conexao PostgreSQL (Fase 4 / Railway). Vazio em dev.
  databaseUrl: process.env.DATABASE_URL || '',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-NAO-use-em-producao',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cache: {
    priceTtlSeconds: Number(process.env.PRICE_CACHE_TTL) || 30,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  coinmarketcapKey: process.env.COINMARKETCAP_API_KEY || '',

  // Caminho da pasta do frontend (servida estaticamente).
  frontendDir: path.join(ROOT, 'frontend'),
};

// Aviso de seguranca em producao.
if (config.env === 'production' && config.jwt.secret.startsWith('dev-secret')) {
  console.warn('[config] ATENCAO: JWT_SECRET nao foi definido em producao!');
}
