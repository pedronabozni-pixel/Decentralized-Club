// ==========================================================================
//  Rotas do diario de operacoes de cripto (/api/journal).
//  Liberado so para os e-mails de JOURNAL_EMAILS: para qualquer outra conta,
//  toda rota daqui responde 404, como se nao existisse. O menu pergunta em
//  /api/journal/enabled, entao quem decide se o item aparece e o servidor.
//  O preco atual nao passa pelo servidor: a tela busca na Binance Futures.
// ==========================================================================
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, validate, notFound } from '../middleware/errorHandler.js';
import { tradePlansRepo } from '../repositories/tradePlans.js';
import { analyzePlan, journalSummary } from '../services/tradeCalc.js';

const router = Router();
router.use(requireAuth);
router.use((req, res, next) => {
  const email = String(req.user.email || '').toLowerCase();
  if (!config.journalEmails.has(email)) return notFound(req, res);
  next();
});

const MARKETS = ['perpetuo', 'spot'];
const DIRECTIONS = ['compra', 'venda'];
const STATUSES = ['planejado', 'aguardando_entrada', 'aberto', 'encerrado', 'cancelado'];

// Campo vazio ('' ou null) vira null; texto com so espacos tambem.
const blankToNull = (v) => (v === '' || v === null ? null : v);
const text = (max) => z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || null : v),
  z.string().max(max, `Texto acima de ${max} caracteres.`).nullable()
).optional();
const price = (label) => z.coerce.number({ invalid_type_error: `${label} invalido.` })
  .positive(`${label} invalido.`);
const optionalPrice = (label) => z.preprocess(blankToNull, price(label).nullable()).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida (YYYY-MM-DD).');
const optionalDate = z.preprocess(blankToNull, isoDate.nullable()).optional();
const oneOf = (values, label) => z.enum(values, { errorMap: () => ({ message: `${label} invalido.` }) });

const entrySchema = z.object({
  zoneFrom: price('Preco da entrada'),
  zoneTo: optionalPrice('Preco da entrada'),
  amountUsd: z.coerce.number().positive('Valor da entrada invalido.'),
  executedPrice: optionalPrice('Preco executado'),
  eventDate: optionalDate,
});
const targetSchema = z.object({
  zoneFrom: price('Preco do alvo'),
  zoneTo: optionalPrice('Preco do alvo'),
  content: text(300),
});
const alertSchema = z.object({ price: price('Preco do alerta'), content: text(300) });
const exitSchema = z.object({
  price: price('Preco da saida'),
  fraction: z.coerce.number().gt(0, 'Fracao da saida invalida.').max(1, 'Fracao da saida acima de 100%.'),
  eventDate: optionalDate,
});
const noteSchema = z.object({
  content: z.string().trim().min(1, 'Nota vazia.').max(5000, 'Nota acima de 5000 caracteres.'),
  eventDate: isoDate,
});

const fmtUsd = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const planSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,30}$/, 'Ativo invalido (ex: MANTAUSDT).'),
  market: oneOf(MARKETS, 'Mercado'),
  exchange: text(60),
  direction: oneOf(DIRECTIONS, 'Direcao'),
  status: oneOf(STATUSES, 'Status'),
  callSource: text(200),
  callText: text(10000),
  thesis: text(10000),
  capitalUsd: z.coerce.number().positive('Capital invalido.'),
  leverage: z.preprocess(
    (v) => (v === '' || v == null ? 1 : v),
    z.coerce.number().min(1, 'Alavancagem minima e 1x.').max(200, 'Alavancagem maxima e 200x.')
  ),
  structuralLevel: optionalPrice('Nivel estrutural'),
  stopPrice: price('Stop'),
  entries: z.array(entrySchema).min(1, 'Informe ao menos uma entrada.').max(20),
  targets: z.array(targetSchema).max(20).default([]),
  alerts: z.array(alertSchema).max(30).default([]),
  exits: z.array(exitSchema).max(30).default([]),
  notes: z.array(noteSchema).max(300).default([]),
}).superRefine((p, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  const entriesUsd = p.entries.reduce((s, e) => s + e.amountUsd, 0);
  if (entriesUsd > p.capitalUsd * (1 + 1e-9)) {
    issue('entries', `As entradas somam US$ ${fmtUsd(entriesUsd)} e passam do capital de US$ ${fmtUsd(p.capitalUsd)}.`);
  }
  if (p.market === 'spot' && p.leverage !== 1) {
    issue('leverage', 'Spot nao tem alavancagem: use 1x.');
  }
  const exitsFraction = p.exits.reduce((s, x) => s + x.fraction, 0);
  if (exitsFraction > 1 + 1e-6) {
    issue('exits', 'As saidas somam mais de 100% da posicao.');
  }
  const anyFilled = p.entries.some((e) => e.executedPrice > 0);
  if (p.exits.length && !anyFilled) {
    issue('exits', 'Registre o preco executado de ao menos uma entrada antes das saidas.');
  }
  if (p.status === 'encerrado') {
    if (!anyFilled) issue('status', 'Plano encerrado precisa de ao menos uma entrada executada.');
    if (Math.abs(exitsFraction - 1) > 0.001) issue('status', 'Plano encerrado precisa de saidas somando 100% da posicao.');
  }
});

const withCalc = (plan) => ({ ...plan, calc: analyzePlan(plan) });

// GET /api/journal/enabled -> 200 so para quem tem o diario (o menu usa isto)
router.get('/enabled', (req, res) => {
  res.json({ enabled: true });
});

// GET /api/journal/plans -> todos os planos do usuario + totais
router.get('/plans', asyncHandler(async (req, res) => {
  const items = tradePlansRepo.listByUser(req.user.id).map(withCalc);
  res.json({ items, summary: journalSummary(items) });
}));

// GET /api/journal/plans/:id
router.get('/plans/:id', asyncHandler(async (req, res) => {
  const plan = tradePlansRepo.findById(req.user.id, Number(req.params.id));
  if (!plan) return res.status(404).json({ error: 'Plano nao encontrado.' });
  res.json({ item: withCalc(plan) });
}));

// POST /api/journal/plans -> cria plano e niveis numa transacao
router.post('/plans', asyncHandler(async (req, res) => {
  const data = validate(planSchema, req.body);
  const plan = tradePlansRepo.create(req.user.id, data);
  res.status(201).json({ item: withCalc(plan) });
}));

// PUT /api/journal/plans/:id -> edicao completa (plano + todos os niveis)
router.put('/plans/:id', asyncHandler(async (req, res) => {
  const data = validate(planSchema, req.body);
  const plan = tradePlansRepo.update(req.user.id, Number(req.params.id), data);
  if (!plan) return res.status(404).json({ error: 'Plano nao encontrado.' });
  res.json({ item: withCalc(plan) });
}));

// DELETE /api/journal/plans/:id -> apaga plano e niveis juntos
router.delete('/plans/:id', asyncHandler(async (req, res) => {
  const ok = tradePlansRepo.remove(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Plano nao encontrado.' });
  res.json({ ok: true });
}));

export default router;
