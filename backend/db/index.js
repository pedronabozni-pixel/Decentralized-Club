// ==========================================================================
//  Conexao com o banco (SQLite via better-sqlite3).
//  Camada isolada: todo acesso ao banco passa por aqui e pelos repositories,
//  o que torna a futura migracao para PostgreSQL (Fase 4) uma troca contida.
// ==========================================================================
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Garante que a pasta do arquivo .db exista.
fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });

export const db = new Database(config.sqlitePath);
db.pragma('journal_mode = WAL'); // melhor concorrencia leitura/escrita
db.pragma('foreign_keys = ON');

/**
 * Cria as tabelas a partir do schema.sql caso ainda nao existam.
 * Idempotente: pode ser chamado a cada boot com seguranca.
 */
export function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  return true;
}
