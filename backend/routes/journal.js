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
const STATUS_LABEL = {
  planejado: 'Planejado', aguardando_entrada: 'Aguardando entrada', aberto: 'Aberto',
  encerrado: 'Encerrado', cancelado: 'Cancelado',
};
// Planejado e cancelado sao rascunho: so ativo, mercado e direcao sao
// obrigatorios. A partir de aguardando entrada o plano precisa estar completo:
// capital, ao menos uma entrada, valor em US$ em cada entrada e stop.
const NEEDS_COMPLETE = ['aguardando_entrada', 'aberto', 'encerrado'];
// "a", "a e b", "a, b e c"
const listPt = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : String(items[0]));

// Campo vazio ('' ou null) vira null; texto com so espacos tambem.
const blankToNull = (v) => (v === '' || v === null ? null : v);
const text = (max) => z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || null : v),
  z.string().max(max, `Texto acima de ${max} caracteres.`).nullable()
).optional();
const positive = (label) => z.coerce.number({ invalid_type_error: `${label} invalido.` })
  .positive(`${label} invalido.`);
const optionalPositive = (label) => z.preprocess(blankToNull, positive(label).nullable()).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida (YYYY-MM-DD).');
const optionalDate = z.preprocess(blankToNull, isoDate.nullable()).optional();
const oneOf = (values, label) => z.enum(values, { errorMap: () => ({ message: `${label} invalido.` }) });

const entrySchema = z.object({
  zoneFrom: positive('Preco da entrada'),
  zoneTo: optionalPositive('Preco da entrada'),
  amountUsd: optionalPositive('Valor da entrada'),
  executedPrice: optionalPositive('Preco executado'),
  eventDate: optionalDate,
});
const targetSchema = z.object({
  zoneFrom: positive('Preco do alvo'),
  zoneTo: optionalPositive('Preco do alvo'),
  content: text(300),
});
const alertSchema = z.object({ price: positive('Preco do alerta'), content: text(300) });
const exitSchema = z.object({
  price: positive('Preco da saida'),
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
  capitalUsd: optionalPositive('Capital'),
  leverage: z.preprocess(
    (v) => (v === '' || v == null ? 1 : v),
    z.coerce.number().min(1, 'Alavancagem minima e 1x.').max(200, 'Alavancagem maxima e 200x.')
  ),
  structuralLevel: optionalPositive('Nivel estrutural'),
  stopPrice: optionalPositive('Stop'),
  entries: z.array(entrySchema).max(20).default([]),
  targets: z.array(targetSchema).max(20).default([]),
  alerts: z.array(alertSchema).max(30).default([]),
  exits: z.array(exitSchema).max(30).default([]),
  notes: z.array(noteSchema).max(300).default([]),
}).superRefine((p, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (NEEDS_COMPLETE.includes(p.status)) {
    const missing = [];
    if (!(p.capitalUsd > 0)) missing.push('capital');
    if (!p.entries.length) missing.push('ao menos uma entrada');
    const noValue = p.entries.map((e, i) => (e.amountUsd > 0 ? null : i + 1)).filter(Boolean);
    if (noValue.length) {
      missing.push(`valor em US$ ${noValue.length > 1 ? 'das entradas' : 'da entrada'} ${listPt(noValue)}`);
    }
    if (!(p.stopPrice > 0)) missing.push('stop');
    if (missing.length) {
      issue('status', `Para o status ${STATUS_LABEL[p.status]} o plano precisa estar completo. Falta: ${listPt(missing)}.`);
    }
  }
  // Entradas acima do capital so e erro quando o plano tem capital.
  const entriesUsd = p.entries.reduce((s, e) => s + (e.amountUsd || 0), 0);
  if (p.capitalUsd > 0 && entriesUsd > p.capitalUsd * (1 + 1e-9)) {
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
