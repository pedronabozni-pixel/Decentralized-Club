// ==========================================================================
//  Rotas de outros ativos: bolsa BR, internacional, moedas, ouro, fundos,
//  previdencia e ativos fisicos. Cotacao automatica quando ha ticker;
//  valor manual (current_value) para o restante.
// ==========================================================================
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/errorHandler.js';
import { assetsRepo } from '../repositories/assets.js';
import { ASSET_CATEGORIES } from '../services/assetCategories.js';
import { enrichAsset, valuateUserAssets } from '../services/assetsValuation.js';

const router = Router();
router.use(requireAuth);

const assetSchema = z.object({
  category: z.string().refine((c) => c in ASSET_CATEGORIES, 'Categoria invalida.'),
  name: z.string().trim().min(1, 'Nome obrigatorio.').max(120),
  ticker: z.string().trim().max(20).transform((s) => s.toUpperCase()).optional().or(z.literal('')),
  quantity: z.coerce.number().positive().optional().nullable(),
  invested: z.coerce.number().nonnegative('Valor investido invalido.'),
  currentValue: z.coerce.number().nonnegative().optional().nullable(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/assets/categories -> catalogo p/ o select do frontend
router.get('/categories', (req, res) => {
  res.json({ categories: ASSET_CATEGORIES });
});

// GET /api/assets -> lista enriquecida + resumo
router.get('/', asyncHandler(async (req, res) => {
  const { items, summary } = await valuateUserAssets(req.user.id);
  res.json({ items, summary });
}));

// POST /api/assets
router.post('/', asyncHandler(async (req, res) => {
  const data = validate(assetSchema, req.body);
  const item = assetsRepo.create({
    userId: req.user.id,
    category: data.category,
    name: data.name,
    ticker: data.ticker || null,
    quantity: data.quantity ?? null,
    invested: data.invested,
    currentValue: data.currentValue ?? null,
    purchaseDate: data.purchaseDate || null,
    notes: data.notes,
  });
  res.status(201).json({ item: await enrichAsset(item) });
}));

// PATCH /api/assets/:id/value -> atualiza valor atual (ativos manuais)
router.patch('/:id/value', asyncHandler(async (req, res) => {
  const value = Number(req.body?.currentValue);
  if (!Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: 'Valor atual invalido.' });
  }
  const ok = assetsRepo.updateCurrentValue(req.user.id, Number(req.params.id), value);
  if (!ok) return res.status(404).json({ error: 'Ativo nao encontrado.' });
  res.json({ ok: true });
}));

// DELETE /api/assets/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const ok = assetsRepo.remove(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Ativo nao encontrado.' });
  res.json({ ok: true });
}));

export default router;
