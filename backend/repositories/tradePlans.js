// Repository do diario de operacoes (planos de trade e seus niveis).
// Toda consulta filtra por user_id, inclusive nos niveis. Plano e niveis
// gravam juntos numa transacao: ou entra tudo, ou nada.
import { db } from '../db/index.js';

// Linha do banco -> plano com os niveis agrupados por tipo.
function toPlan(row, levels) {
  const of = (kind) => levels.filter((l) => l.kind === kind);
  return {
    id: row.id,
    symbol: row.symbol,
    market: row.market,
    exchange: row.exchange,
    direction: row.direction,
    status: row.status,
    callSource: row.call_source,
    callText: row.call_text,
    thesis: row.thesis,
    capitalUsd: row.capital_usd,
    leverage: row.leverage,
    structuralLevel: row.structural_level,
    stopPrice: row.stop_price,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    entries: of('entrada').map((l) => ({
      zoneFrom: l.zone_from, zoneTo: l.zone_to, amountUsd: l.amount_usd,
      executedPrice: l.executed_price, eventDate: l.event_date,
    })),
    targets: of('alvo').map((l) => ({ zoneFrom: l.zone_from, zoneTo: l.zone_to, content: l.content })),
    alerts: of('alerta').map((l) => ({ price: l.price, content: l.content })),
    exits: of('saida').map((l) => ({ price: l.price, fraction: l.fraction, eventDate: l.event_date })),
    notes: of('nota').map((l) => ({ content: l.content, eventDate: l.event_date })),
  };
}

// Campos do plano em parametros nomeados (iguais no insert e no update).
function planParams(userId, data) {
  return {
    userId,
    symbol: data.symbol,
    market: data.market,
    exchange: data.exchange ?? null,
    direction: data.direction,
    status: data.status,
    callSource: data.callSource ?? null,
    callText: data.callText ?? null,
    thesis: data.thesis ?? null,
    capitalUsd: data.capitalUsd ?? null,
    leverage: data.leverage ?? 1,
    structuralLevel: data.structuralLevel ?? null,
    stopPrice: data.stopPrice ?? null,
  };
}

function insertLevels(userId, planId, data) {
  const stmt = db.prepare(`
    INSERT INTO trade_plan_levels
      (plan_id, user_id, kind, position, zone_from, zone_to, amount_usd,
       executed_price, price, fraction, event_date, content)
    VALUES
      (@planId, @userId, @kind, @position, @zoneFrom, @zoneTo, @amountUsd,
       @executedPrice, @price, @fraction, @eventDate, @content)
  `);
  const base = {
    planId, userId, zoneFrom: null, zoneTo: null, amountUsd: null,
    executedPrice: null, price: null, fraction: null, eventDate: null, content: null,
  };
  const groups = [
    ['entrada', data.entries, (e) => ({
      zoneFrom: e.zoneFrom, zoneTo: e.zoneTo ?? null, amountUsd: e.amountUsd,
      executedPrice: e.executedPrice ?? null, eventDate: e.eventDate ?? null,
    })],
    ['alvo', data.targets, (t) => ({ zoneFrom: t.zoneFrom, zoneTo: t.zoneTo ?? null, content: t.content ?? null })],
    ['alerta', data.alerts, (a) => ({ price: a.price, content: a.content ?? null })],
    ['saida', data.exits, (x) => ({ price: x.price, fraction: x.fraction, eventDate: x.eventDate ?? null })],
    ['nota', data.notes, (n) => ({ content: n.content, eventDate: n.eventDate ?? null })],
  ];
  for (const [kind, items, fields] of groups) {
    (items || []).forEach((item, position) => {
      stmt.run({ ...base, kind, position, ...fields(item) });
    });
  }
}

function removeLevels(userId, planId) {
  db.prepare(`DELETE FROM trade_plan_levels WHERE plan_id = ? AND user_id = ?`).run(planId, userId);
}

// Encerrado ou cancelado guarda a data do encerramento; voltar a um status
// em andamento limpa a data.
const CLOSED_AT_ON_INSERT = `CASE WHEN @status IN ('encerrado', 'cancelado') THEN datetime('now') ELSE NULL END`;
const CLOSED_AT_ON_UPDATE = `CASE WHEN @status IN ('encerrado', 'cancelado') THEN COALESCE(closed_at, datetime('now')) ELSE NULL END`;

const createTx = db.transaction((userId, data) => {
  const info = db.prepare(`
    INSERT INTO trade_plans
      (user_id, symbol, market, exchange, direction, status, call_source, call_text,
       thesis, capital_usd, leverage, structural_level, stop_price, closed_at)
    VALUES
      (@userId, @symbol, @market, @exchange, @direction, @status, @callSource, @callText,
       @thesis, @capitalUsd, @leverage, @structuralLevel, @stopPrice, ${CLOSED_AT_ON_INSERT})
  `).run(planParams(userId, data));
  insertLevels(userId, info.lastInsertRowid, data);
  return info.lastInsertRowid;
});

const updateTx = db.transaction((userId, id, data) => {
  const info = db.prepare(`
    UPDATE trade_plans SET
      symbol = @symbol, market = @market, exchange = @exchange, direction = @direction,
      status = @status, call_source = @callSource, call_text = @callText, thesis = @thesis,
      capital_usd = @capitalUsd, leverage = @leverage, structural_level = @structuralLevel,
      stop_price = @stopPrice, updated_at = datetime('now'), closed_at = ${CLOSED_AT_ON_UPDATE}
    WHERE id = @id AND user_id = @userId
  `).run({ ...planParams(userId, data), id });
  if (info.changes === 0) return false;
  removeLevels(userId, id);
  insertLevels(userId, id, data);
  return true;
});

const removeTx = db.transaction((userId, id) => {
  removeLevels(userId, id);
  const info = db.prepare(`DELETE FROM trade_plans WHERE id = ? AND user_id = ?`).run(id, userId);
  return info.changes > 0;
});

export const tradePlansRepo = {
  // Planos do usuario (mais recentes primeiro), cada um com os seus niveis.
  listByUser(userId) {
    const rows = db
      .prepare(`SELECT * FROM trade_plans WHERE user_id = ? ORDER BY created_at DESC, id DESC`)
      .all(userId);
    const levels = db
      .prepare(`SELECT * FROM trade_plan_levels WHERE user_id = ? ORDER BY plan_id, kind, position, id`)
      .all(userId);
    const byPlan = new Map();
    for (const l of levels) {
      if (!byPlan.has(l.plan_id)) byPlan.set(l.plan_id, []);
      byPlan.get(l.plan_id).push(l);
    }
    return rows.map((row) => toPlan(row, byPlan.get(row.id) || []));
  },

  findById(userId, id) {
    const row = db.prepare(`SELECT * FROM trade_plans WHERE id = ? AND user_id = ?`).get(id, userId);
    if (!row) return null;
    const levels = db
      .prepare(`SELECT * FROM trade_plan_levels WHERE plan_id = ? AND user_id = ? ORDER BY kind, position, id`)
      .all(id, userId);
    return toPlan(row, levels);
  },

  create(userId, data) {
    const id = createTx(userId, data);
    return this.findById(userId, id);
  },

  // Edicao completa: atualiza o plano e troca todos os niveis de uma vez.
  update(userId, id, data) {
    return updateTx(userId, id, data) ? this.findById(userId, id) : null;
  },

  remove(userId, id) {
    return removeTx(userId, id);
  },
};
