// ==========================================================================
//  Rota do dashboard geral: consolida cripto + renda fixa, distribuicao da
//  carteira, ganho do dia, ganho total e dados de mercado (dolar/global).
// ==========================================================================
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { cryptoBuysRepo } from '../repositories/cryptoBuys.js';
import { fixedIncomeRepo } from '../repositories/fixedIncome.js';
import { getGlobal, getMarketChart } from '../services/coingecko.js';
import { getUnifiedPrices } from '../services/prices.js';
import { getUsdBrl } from '../services/dollar.js';
import { valuateUserAssets } from '../services/assetsValuation.js';
import {
  buildCryptoPosition, compoundReturn, daysBetween,
} from '../services/calculations.js';

const router = Router();
router.use(requireAuth);

// Moedas tratadas como "Bitcoin" para a distribuicao da carteira.
const BTC_SYMBOLS = new Set(['BTC', 'WBTC']);

// GET /api/portfolio/summary
router.get('/summary', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // ---- Cripto ----
  const positions = cryptoBuysRepo.positions(userId);
  const symbols = positions.map((p) => p.symbol);
  const [prices, usdBrl, global] = await Promise.all([
    getUnifiedPrices(symbols),
    getUsdBrl(),
    getGlobal(),
  ]);

  // Posicoes de cripto em USD (moeda nativa do mercado). A consolidacao do
  // patrimonio converte para BRL pela cotacao atual do dolar.
  const usdRate = usdBrl.rate || 0;
  let cryptoValueUsd = 0;
  let cryptoSpentUsd = 0;
  let cryptoDayChangeUsd = 0; // variacao do dia em US$ (estimada via 24h)
  let btcValueUsd = 0;
  let altcoinsValueUsd = 0;

  const cryptoPositions = positions.map((p) => {
    const market = prices[p.symbol];
    const priceUsd = market ? market.usd : 0;
    const pos = buildCryptoPosition(p, priceUsd);
    const change24h = market ? market.change24h : 0;
    pos.change24h = change24h;

    cryptoValueUsd += pos.currentValue;
    cryptoSpentUsd += pos.totalSpent;
    // Valor de ontem ~ valor atual / (1 + change%/100); ganho do dia = diff.
    const prevValue = change24h !== 0 ? pos.currentValue / (1 + change24h / 100) : pos.currentValue;
    cryptoDayChangeUsd += pos.currentValue - prevValue;

    if (BTC_SYMBOLS.has(p.symbol)) btcValueUsd += pos.currentValue;
    else altcoinsValueUsd += pos.currentValue;

    return pos;
  });

  // Convertidos para BRL (visao consolidada com a renda fixa).
  const cryptoValue = cryptoValueUsd * usdRate;
  const cryptoSpent = cryptoSpentUsd * usdRate;
  const cryptoDayChange = cryptoDayChangeUsd * usdRate;
  const btcValue = btcValueUsd * usdRate;
  const altcoinsValue = altcoinsValueUsd * usdRate;

  // ---- Renda fixa ----
  const fixedItems = fixedIncomeRepo.listByUser(userId);
  const today = new Date().toISOString().slice(0, 10);
  let fixedInvested = 0;
  let fixedValue = 0;
  for (const it of fixedItems) {
    fixedInvested += it.amount;
    const days = daysBetween(it.date_invested, today);
    fixedValue += compoundReturn(it.amount, it.rate, days, it.type).total;
  }

  // ---- Outros ativos (bolsa, fundos, fisicos...) ----
  const assets = await valuateUserAssets(userId);

  // ---- Consolidacao (tudo em BRL) ----
  const totalValue = cryptoValue + fixedValue + assets.summary.currentValue;
  const totalInvested = cryptoSpent + fixedInvested + assets.summary.totalInvested;

  // Distribuicao por classe (so grupos com valor > 0).
  const groups = [
    { key: 'btc', label: 'Bitcoin', value: btcValue },
    { key: 'altcoins', label: 'Altcoins', value: altcoinsValue },
    { key: 'renda_fixa', label: 'Renda Fixa', value: fixedValue },
    { key: 'bolsa_br', label: 'Bolsa Brasil', value: assets.byGroup['Bolsa Brasil'] || 0 },
    { key: 'internacional', label: 'Internacional', value: assets.byGroup['Internacional'] || 0 },
    { key: 'moedas', label: 'Moedas e Metais', value: assets.byGroup['Moedas e Metais'] || 0 },
    { key: 'fundos', label: 'Fundos', value: assets.byGroup['Fundos'] || 0 },
    { key: 'fisicos', label: 'Fisicos', value: assets.byGroup['Fisicos'] || 0 },
  ].filter((g) => g.value > 0)
    .map((g) => ({ ...g, percent: totalValue > 0 ? (g.value / totalValue) * 100 : 0 }));

  res.json({
    totalValue,
    totalInvested,
    totalGainLoss: totalValue - totalInvested,
    totalGainLossPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
    dayChange: cryptoDayChange,
    dayChangePercent: cryptoValue > 0 ? (cryptoDayChange / (cryptoValue - cryptoDayChange)) * 100 : 0,
    crypto: {
      value: cryptoValue,           // BRL (consolidado)
      valueUsd: cryptoValueUsd,     // USD (moeda nativa da secao cripto)
      invested: cryptoSpent,        // BRL
      investedUsd: cryptoSpentUsd,  // USD
      positions: cryptoPositions,   // valores em USD
    },
    fixedIncome: { value: fixedValue, invested: fixedInvested, count: fixedItems.length },
    assets: { value: assets.summary.currentValue, invested: assets.summary.totalInvested, count: assets.items.length },
    allocation: { total: totalValue, groups },
    market: { usdBrl, global },
  });
}));

// GET /api/portfolio/evolution?days=30
// Reconstroi a evolucao do patrimonio avaliando as posicoes atuais a precos
// historicos (CoinGecko) + renda fixa crescendo pela taxa contratada.
router.get('/evolution', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));

  const positions = cryptoBuysRepo.positions(userId);
  const charts = await Promise.all(
    positions.map(async (p) => ({
      qty: p.total_quantity,
      series: await getMarketChart(p.symbol, days),
    }))
  );

  // Indexa preco por dia (YYYY-MM-DD) para cada moeda.
  const dayKeys = new Set();
  const bySymbolDay = charts.map(({ qty, series }) => {
    const map = {};
    for (const pt of series) {
      const key = new Date(pt.t).toISOString().slice(0, 10);
      map[key] = pt.price;
      dayKeys.add(key);
    }
    return { qty, map };
  });

  const days30 = [...dayKeys].sort();

  // Renda fixa: valor por dia (composto ate aquele dia).
  const fixedItems = fixedIncomeRepo.listByUser(userId);

  // Outros ativos: sem serie historica propria (imoveis, fundos etc);
  // entram com o valor atual constante para o grafico bater com o total.
  const assetsNow = await valuateUserAssets(userId);
  const assetsVal = assetsNow.summary.currentValue;

  const points = days30.map((day) => {
    let cryptoVal = 0;
    for (const { qty, map } of bySymbolDay) {
      if (map[day] != null) cryptoVal += qty * map[day];
    }
    let fixedVal = 0;
    for (const it of fixedItems) {
      const d = daysBetween(it.date_invested, day);
      if (d >= 0 && day >= it.date_invested.slice(0, 10)) {
        fixedVal += compoundReturn(it.amount, it.rate, d, it.type).total;
      }
    }
    return {
      date: day,
      total: cryptoVal + fixedVal + assetsVal,
      crypto: cryptoVal,
      fixedIncome: fixedVal,
      assets: assetsVal,
    };
  });

  res.json({ days, points });
}));

export default router;
