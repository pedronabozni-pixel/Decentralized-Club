// ==========================================================================
//  Rotas de metas financeiras: CRUD + calculo de progresso e do aporte
//  mensal necessario para atingir a meta na data alvo (juros compostos).
// ==========================================================================
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/errorHandler.js';
import { goalsRepo } from '../repositories/goals.js';

const router = Router();
router.use(requireAuth);

const goalSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatorio.').max(120),
  targetAmount: z.coerce.number().positive('Valor da meta invalido.'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Data invalida.'),
  expectedRate: z.coerce.number().min(0).max(100).optional(),
  initialAmount: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(300).optional(),
});

/**
 * Aporte mensal necessario para chegar em FV na data alvo:
 *   FV = P(1+i)^n + A * [((1+i)^n - 1) / i]
 * onde i = taxa mensal, n = meses restantes, P = valor inicial.
 */
function monthlyContribution(target, initial, annualRatePct, months) {
  if (months <= 0) return null; // meta vencida
  const i = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  const growth = Math.pow(1 + i, months);
  const futureOfInitial = initial * growth;
  if (futureOfInitial >= target) return 0; // inicial ja basta
  if (i === 0) return (target - initial) / months;
  return ((target - futureOfInitial) * i) / (growth - 1);
}

function enrich(goal) {
  const today = new Date();
  const targetDate = new Date(goal.target_date + 'T00:00:00');
  const monthsLeft = Math.max(0, Math.round((targetDate - today) / (1000 * 60 * 60 * 24 * 30.44)));
  const progress = goal.target_amount > 0
    ? Math.min(100, (goal.initial_amount / goal.target_amount) * 100) : 0;
  return {
    ...goal,
    monthsLeft,
    progressPercent: progress,
    remaining: Math.max(0, goal.target_amount - goal.initial_amount),
    requiredMonthly: monthlyContribution(
      goal.target_amount, goal.initial_amount, goal.expected_rate, monthsLeft
    ),
    overdue: monthsLeft === 0 && progress < 100,
  };
}

// GET /api/goals
router.get('/', asyncHandler(async (req, res) => {
  const items = goalsRepo.listByUser(req.user.id).map(enrich);
  const summary = {
    count: items.length,
    totalTarget: items.reduce((s, g) => s + g.target_amount, 0),
    totalSaved: items.reduce((s, g) => s + g.initial_amount, 0),
    totalRequiredMonthly: items.reduce((s, g) => s + (g.requiredMonthly || 0), 0),
  };
  res.json({ items, summary });
}));

// POST /api/goals
router.post('/', asyncHandler(async (req, res) => {
  const data = validate(goalSchema, req.body);
  const goal = goalsRepo.create({
    userId: req.user.id,
    name: data.name,
    targetAmount: data.targetAmount,
    targetDate: data.targetDate,
    expectedRate: data.expectedRate,
    initialAmount: data.initialAmount,
    notes: data.notes,
  });
  res.status(201).json({ item: enrich(goal) });
}));

// PATCH /api/goals/:id/progress  -> atualiza quanto ja foi guardado
router.patch('/:id/progress', asyncHandler(async (req, res) => {
  const value = Number(req.body?.initialAmount);
  if (!Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: 'Valor invalido.' });
  }
  const ok = goalsRepo.updateProgress(req.user.id, Number(req.params.id), value);
  if (!ok) return res.status(404).json({ error: 'Meta nao encontrada.' });
  res.json({ ok: true });
}));

// DELETE /api/goals/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const ok = goalsRepo.remove(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Meta nao encontrada.' });
  res.json({ ok: true });
}));

export default router;
