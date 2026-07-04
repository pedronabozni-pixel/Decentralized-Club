// ==========================================================================
//  Seed de demonstracao. Cria um usuario demo com algumas compras de cripto
//  e investimentos de renda fixa para visualizar o dashboard imediatamente.
//  Uso: `npm run seed`.  Login:  demo@decentralized.club  /  demo12345
// ==========================================================================
import bcrypt from 'bcryptjs';
import { runMigrations, db } from './index.js';
import { usersRepo } from '../repositories/users.js';
import { cryptoBuysRepo } from '../repositories/cryptoBuys.js';
import { fixedIncomeRepo } from '../repositories/fixedIncome.js';

runMigrations();

const EMAIL = 'demo@decentralized.club';
const PASSWORD = 'demo12345';

// Recria o usuario demo do zero (idempotente).
const existing = usersRepo.findByEmail(EMAIL);
if (existing) {
  db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
  console.log('[seed] usuario demo anterior removido.');
}

const passwordHash = await bcrypt.hash(PASSWORD, 12);
const user = usersRepo.create({ email: EMAIL, passwordHash, name: 'Investidor Demo' });

// Compras de cripto (precos em USD aproximados de compras passadas).
const buys = [
  { symbol: 'BTC', name: 'Bitcoin',  quantity: 0.05,  pricePerUnit: 42000, dateBought: '2024-01-15' },
  { symbol: 'BTC', name: 'Bitcoin',  quantity: 0.03,  pricePerUnit: 60000, dateBought: '2024-06-10' },
  { symbol: 'ETH', name: 'Ethereum', quantity: 0.8,   pricePerUnit: 2300,  dateBought: '2024-03-22' },
  { symbol: 'SOL', name: 'Solana',   quantity: 12,    pricePerUnit: 95,    dateBought: '2024-05-05' },
  { symbol: 'ETH', name: 'Ethereum', quantity: 0.5,   pricePerUnit: 3100,  dateBought: '2024-09-01' },
];
for (const b of buys) cryptoBuysRepo.create({ userId: user.id, ...b });

// Renda fixa.
const fixed = [
  { type: 'CDB', description: 'CDB Liquidez Diaria', amount: 10000, rate: 11.5,
    dateInvested: '2024-02-01', maturityDate: '2026-02-01', bank: 'Banco Inter' },
  { type: 'Tesouro', description: 'Tesouro Selic 2027', amount: 8000, rate: 10.75,
    dateInvested: '2024-04-15', maturityDate: '2027-04-15', bank: 'Tesouro Direto' },
  { type: 'LCI', description: 'LCI isenta de IR', amount: 5000, rate: 9.8,
    dateInvested: '2024-07-20', maturityDate: '2025-07-20', bank: 'Banco do Brasil' },
];
for (const f of fixed) fixedIncomeRepo.create({ userId: user.id, ...f });

console.log('\n[seed] Dados de demonstracao criados!');
console.log(`[seed] Login: ${EMAIL}  |  Senha: ${PASSWORD}\n`);
process.exit(0);
