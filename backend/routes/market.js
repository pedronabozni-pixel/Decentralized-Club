// ==========================================================================
//  Rotas de mercado (dados publicos, exigem login): dolar, global, SELIC,
//  precos avulsos e serie historica de um simbolo (grafico de performance).
// ==========================================================================
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getUsdBrl } from '../services/dollar.js';
import { getGlobal } from '../services/coingecko.js';
import { getSpotUsdt } from '../services/binance.js';
import { getUnifiedPrices } from '../services/prices.js';
import { priceHistoryRepo } from '../repositories/priceHistory.js';

const router = Router();
router.use(requireAuth);

// GET /api/market/dollar
router.get('/dollar', asyncHandler(async (req, res) => {
  res.json(await getUsdBrl());
}));

// GET /api/market/global
router.get('/global', asyncHandler(async (req, res) => {
  res.json(await getGlobal());
}));

// GET /api/market/prices?symbols=BTC,ETH  -> precos atuais (CoinGecko + Binance)
router.get('/prices', asyncHandler(async (req, res) => {
  const symbols = String(req.query.symbols || '')
    .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length) return res.json({ prices: {} });

  const [unified, binance, usd] = await Promise.all([
    getUnifiedPrices(symbols),
    getSpotUsdt(symbols),
    getUsdBrl(),
  ]);

  // Precos unificados (CoinGecko -> Binance -> CoinMarketCap) + spot Binance
  // como referencia bruta em USDT.
  const merged = {};
  for (const s of symbols) {
    merged[s] = {
      brl: unified[s]?.brl ?? 0,
      usd: unified[s]?.usd ?? 0,
      change24h: unified[s]?.change24h ?? 0,
      source: unified[s]?.source ?? null,
      binanceUsdt: binance[s] ?? null,
    };
  }
  res.json({ prices: merged, usdBrl: usd.rate });
}));

// GET /api/market/history/:symbol?days=30  -> serie do historico de precos
router.get('/history/:symbol', asyncHandler(async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const days = Math.min(365, Number(req.query.days) || 30);
  res.json({ symbol, points: priceHistoryRepo.recent(symbol, days) });
}));

export default router;
