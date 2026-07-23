// ==========================================================================
//  Rotas de renda fixa: CRUD, dashboard (investido / rendimento) e simulador.
// ==========================================================================
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/errorHandler.js';
import { fixedIncomeRepo } from '../repositories/fixedIncome.js';
import { compoundReturn, daysBetween } from '../services/calculations.js';
import { getSelic } from '../services/bcb.js';

const router = Router();
router.use(requireAuth);

const investmentSchema = z.object({
  type: z.string().trim().min(1, 'Tipo obrigatorio.').max(40),
  description: z.string().trim().max(120).optional(),
  amount: z.coerce.number().positive('Valor deve ser maior que zero.'),
  rate: z.coerce.number().min(0, 'Taxa invalida.').max(100),
  dateInvested: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Data invalida.'),
  maturityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Data invalida.').optional().or(z.literal('')),
  bank: z.string().trim().max(80).optional(),
});

const simulateSchema = z.object({
  amount: z.coerce.number().positive(),
  rate: z.coerce.number().min(0).max(100),
  periodDays: z.coerce.number().int().positive(),
  monthlyContribution: z.coerce.number().min(0).optional(),
  type: z.string().trim().max(40).optional(),
});

// GET /api/fixed-income/selic  -> taxa SELIC atual (sugestao p/ o simulador)
router.get('/selic', asyncHandler(async (req, res) => {
  res.json(await getSelic());
}));

// GET /api/fixed-income  -> lista + dashboard consolidado
router.get('/', asyncHandler(async (req, res) => {
  const items = fixedIncomeRepo.listByUser(req.user.id);
  const today = new Date().toISOString().slice(0, 10);

  let totalInvested = 0;
  let accruedYield = 0;   // rendimento liquido ate hoje
  let projectedYield = 0; // rendimento liquido projetado ate o vencimento

  const enriched = items.map((it) => {
    totalInvested += it.amount;

    const daysSoFar = daysBetween(it.date_invested, today);
    const accrued = compoundReturn(it.amount, it.rate, daysSoFar, it.type);
    accruedYield += accrued.netYield;

    let projected = null;
    if (it.maturity_date) {
      const daysTotal = daysBetween(it.date_invested, it.maturity_date);
      projected = compoundReturn(it.amount, it.rate, daysTotal, it.type);
      projectedYield += projected.netYield;
    }

    return {
      ...it,
      currentValue: accrued.total,
      accruedYield: accrued.netYield,
      projectedYield: projected ? projected.netYield : null,
      projectedTotal: projected ? projected.total : null,
    };
  });

  res.json({
    items: enriched,
    summary: {
      totalInvested,
      accruedYield,
      projectedYield,
      currentValue: totalInvested + accruedYield,
    },
  });
}));

// POST /api/fixed-income
router.post('/', asyncHandler(async (req, res) => {
  const data = validate(investmentSchema, req.body);
  const item = fixedIncomeRepo.create({
    userId: req.user.id,
    type: data.type,
    description: data.description,
    amount: data.amount,
    rate: data.rate,
    dateInvested: data.dateInvested,
    maturityDate: data.maturityDate || null,
    bank: data.bank,
  });
  res.status(201).json({ item });
}));

// PUT /api/fixed-income/:id -> edicao completa de um investimento
router.put('/:id', asyncHandler(async (req, res) => {
  const data = validate(investmentSchema, req.body);
  const item = fixedIncomeRepo.update(req.user.id, Number(req.params.id), {
    type: data.type,
    description: data.description,
    amount: data.amount,
    rate: data.rate,
    dateInvested: data.dateInvested,
    maturityDate: data.maturityDate || null,
    bank: data.bank,
  });
  if (!item) return res.status(404).json({ error: 'Investimento nao encontrado.' });
  res.json({ item });
}));

// DELETE /api/fixed-income/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const ok = fixedIncomeRepo.remove(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Investimento nao encontrado.' });
  res.json({ ok: true });
}));

// POST /api/fixed-income/simulate  -> simulador de juros (bruto, IR, liquido),
// com aportes mensais opcionais (anuidade com capitalizacao mensal).
router.post('/simulate', asyncHandler(async (req, res) => {
  const data = validate(simulateSchema, req.body);
  const base = compoundReturn(data.amount, data.rate, data.periodDays, data.type || '');

  const aporte = data.monthlyContribution || 0;
  if (aporte <= 0) {
    return res.json({ result: { ...base, monthlyContribution: 0, totalContributed: 0, months: 0 } });
  }

  // Valor futuro dos aportes: A x [((1+i)^n - 1) / i], i = taxa mensal.
  const months = Math.max(0, Math.floor(data.periodDays / 30.44));
  const i = Math.pow(1 + data.rate / 100, 1 / 12) - 1;
  const fvContrib = i > 0
    ? aporte * ((Math.pow(1 + i, months) - 1) / i)
    : aporte * months;
  const totalContributed = aporte * months;
  const contribYield = fvContrib - totalContributed;

  const invested = data.amount + totalContributed;
  const grossYield = base.grossYield + contribYield;
  const irAmount = grossYield * base.irRate;
  const netYield = grossYield - irAmount;

  res.json({
    result: {
      principal: data.amount,
      monthlyContribution: aporte,
      totalContributed,
      months,
      invested,
      days: data.periodDays,
      grossYield,
      irRate: base.irRate,
      irAmount,
      netYield,
      total: invested + netYield,
    },
  });
}));

export default router;
