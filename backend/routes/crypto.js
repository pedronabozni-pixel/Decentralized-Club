// ==========================================================================
//  Rotas de criptomoedas: CRUD de compras, posicoes consolidadas (com preco
//  medio e ganho/perda) e historico por moeda.
// ==========================================================================
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/errorHandler.js';
import { cryptoBuysRepo } from '../repositories/cryptoBuys.js';
import { priceHistoryRepo } from '../repositories/priceHistory.js';
import { searchCoins } from '../services/coingecko.js';
import { getUnifiedPrices } from '../services/prices.js';
import { buildCryptoPosition } from '../services/calculations.js';

const router = Router();
router.use(requireAuth);

const buySchema = z.object({
  symbol: z.string().trim().min(1).max(20).transform((s) => s.toUpperCase()),
  name: z.string().trim().max(80).optional(),
  quantity: z.coerce.number().positive('Quantidade deve ser maior que zero.'),
  pricePerUnit: z.coerce.number().nonnegative('Preco invalido.'),
  dateBought: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Data invalida (YYYY-MM-DD).'),
});

// GET /api/crypto/search?q=sol  -> autocomplete de moedas
router.get('/search', asyncHandler(async (req, res) => {
  const results = await searchCoins(req.query.q);
  res.json({ results });
}));

// GET /api/crypto/buys  -> todas as compras do usuario (historico geral)
router.get('/buys', asyncHandler(async (req, res) => {
  res.json({ buys: cryptoBuysRepo.listByUser(req.user.id) });
}));

// GET /api/crypto/buys/:symbol  -> historico de compras de uma moeda
router.get('/buys/:symbol', asyncHandler(async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  res.json({ buys: cryptoBuysRepo.listBySymbol(req.user.id, symbol) });
}));

// POST /api/crypto/buys  -> registra uma compra (recalcula preco medio)
router.post('/buys', asyncHandler(async (req, res) => {
  const data = validate(buySchema, req.body);
  const buy = cryptoBuysRepo.create({
    userId: req.user.id,
    symbol: data.symbol,
    name: data.name,
    quantity: data.quantity,
    pricePerUnit: data.pricePerUnit,
    dateBought: data.dateBought,
  });
  res.status(201).json({ buy });
}));

// DELETE /api/crypto/buys/:id
router.delete('/buys/:id', asyncHandler(async (req, res) => {
  const ok = cryptoBuysRepo.remove(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Compra nao encontrada.' });
  res.json({ ok: true });
}));

// GET /api/crypto/positions  -> posicoes consolidadas com preco atual de mercado
// Valores de cripto em USD (compras registradas em US$; renda fixa fica em BRL).
router.get('/positions', asyncHandler(async (req, res) => {
  const positions = cryptoBuysRepo.positions(req.user.id);
  const symbols = positions.map((p) => p.symbol);
  const prices = await getUnifiedPrices(symbols);

  const enriched = positions.map((p) => {
    const market = prices[p.symbol];
    const currentPriceUsd = market ? market.usd : 0;
    // Registra preco atual (USD) p/ o grafico de performance (max 1x/hora).
    if (currentPriceUsd > 0) priceHistoryRepo.recordThrottled(p.symbol, currentPriceUsd);
    const pos = buildCryptoPosition(p, currentPriceUsd);
    pos.change24h = market ? market.change24h : 0;
    return pos;
  });

  const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0);
  const totalSpent = enriched.reduce((s, p) => s + p.totalSpent, 0);

  res.json({
    positions: enriched,
    summary: {
      totalValue,
      totalSpent,
      totalGainLoss: totalValue - totalSpent,
      totalGainLossPercent: totalSpent > 0 ? ((totalValue - totalSpent) / totalSpent) * 100 : 0,
    },
  });
}));

export default router;
