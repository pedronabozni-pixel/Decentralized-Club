// ==========================================================================
//  DECENTRALIZED CLUB - servidor Express.
//  Serve a API (/api/*) e o frontend estatico (frontend/).
// ==========================================================================
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { config } from './config.js';
import { runMigrations } from './db/index.js';

import authRoutes from './routes/auth.js';
import cryptoRoutes from './routes/crypto.js';
import fixedIncomeRoutes from './routes/fixedIncome.js';
import portfolioRoutes from './routes/portfolio.js';
import marketRoutes from './routes/market.js';
import assetsRoutes from './routes/assets.js';
import goalsRoutes from './routes/goals.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Garante o schema do banco no boot (idempotente).
runMigrations();

const app = express();

app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: '256kb' }));

// Healthcheck (util no Railway).
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: config.env, time: new Date().toISOString() });
});

// API
app.use('/api/auth', authRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/fixed-income', fixedIncomeRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/goals', goalsRoutes);

// 404 apenas para rotas /api/* desconhecidas.
app.use('/api', notFound);

// Frontend estatico.
app.use(express.static(config.frontendDir));

// SPA-ish fallback: qualquer rota nao-API devolve o index.html.
app.get('*', (req, res) => {
  res.sendFile(path.join(config.frontendDir, 'index.html'));
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`\n  Decentralized Club rodando em http://localhost:${config.port}`);
  console.log(`  Ambiente: ${config.env}  |  Banco: ${path.basename(config.sqlitePath)}\n`);
});
