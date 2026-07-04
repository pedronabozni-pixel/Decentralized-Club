// ==========================================================================
//  Script de migracao: cria/atualiza as tabelas. Uso: `npm run migrate`.
// ==========================================================================
import { runMigrations } from './index.js';

runMigrations();
console.log('[migrate] Tabelas criadas/atualizadas com sucesso.');
process.exit(0);
