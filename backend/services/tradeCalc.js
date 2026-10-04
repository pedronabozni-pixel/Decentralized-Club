// ==========================================================================
//  Calculos do diario de operacoes de cripto. Funcoes puras (sem I/O).
//  Precos em US$ (USDT). O valor de cada entrada e margem; o tamanho da
//  posicao e margem x alavancagem. Na venda, toda a conta e invertida pelo
//  sinal da direcao (+1 compra, -1 venda).
// ==========================================================================

const EPS = 1e-12;

/** +1 para compra, -1 para venda. */
export function directionSign(direction) {
  return direction === 'venda' ? -1 : 1;
}

/** Ponto medio de uma zona (de, ate). Sem "ate", vale o "de". */
export function zoneMid(from, to) {
  return to > 0 ? (from + to) / 2 : from;
}

/** Entrada preenchida = tem preco executado. */
export function isFilled(entry) {
  return entry.executedPrice > 0;
}

/** Preco da entrada: ponto medio da zona ate ser preenchida, depois o executado. */
export function entryPrice(entry) {
  return isFilled(entry) ? entry.executedPrice : zoneMid(entry.zoneFrom, entry.zoneTo);
}

/**
 * Ordem em que as entradas preenchem: na compra, da zona mais alta para a
 * mais baixa; na venda, da mais baixa para a mais alta. A "1a entrada" e a
 * primeira desta ordem. Empate mantem a ordem digitada.
 */
export function fillOrder(entries, direction) {
  const s = directionSign(direction);
  return entries
    .map((e, i) => ({ e, i, mid: zoneMid(e.zoneFrom, e.zoneTo) }))
    .sort((a, b) => s * (b.mid - a.mid) || a.i - b.i)
    .map((x) => x.e);
}

/** Alvos na ordem em que o preco chega neles (compra: do menor; venda: do maior). */
export function targetOrder(targets, direction) {
  const s = directionSign(direction);
  return targets
    .map((t, i) => ({ t, i, mid: zoneMid(t.zoneFrom, t.zoneTo) }))
    .sort((a, b) => s * (a.mid - b.mid) || a.i - b.i)
    .map((x) => x.t);
}

/**
 * Agrega entradas numa posicao: margem (soma dos US$), tamanho (margem x
 * alavancagem), quantidade de moedas e preco medio ponderado pela
 * quantidade de moedas (nao e a media simples dos precos).
 */
export function aggregate(entries, leverage = 1) {
  let marginUsd = 0;
  let quantity = 0;
  for (const e of entries) {
    const price = entryPrice(e);
    if (!(price > 0) || !(e.amountUsd > 0)) continue;
    marginUsd += e.amountUsd;
    quantity += (e.amountUsd * leverage) / price;
  }
  const notionalUsd = marginUsd * leverage;
  return {
    marginUsd,
    notionalUsd,
    quantity,
    avgPrice: quantity > EPS ? notionalUsd / quantity : null,
  };
}

/** Resultado em US$ se a posicao inteira sair no preco `exit` (negativo = perda). */
export function pnlAt(position, exit, direction) {
  if (!(position?.quantity > EPS) || !(exit > 0)) return null;
  return directionSign(direction) * position.quantity * (exit - position.avgPrice);
}

/**
 * Liquidacao aproximada em margem isolada: preco medio x (1 - 1/alavancagem)
 * na compra e x (1 + 1/alavancagem) na venda. Ignora taxas e margem de
 * manutencao, entao a liquidacao real acontece um pouco antes deste preco.
 * Sem alavancagem (1x) nao ha liquidacao.
 */
export function approxLiquidation(avgPrice, leverage, direction) {
  if (!(leverage > 1) || !(avgPrice > 0)) return null;
  return avgPrice * (1 - directionSign(direction) / leverage);
}

/** Stop alem da liquidacao: o preco liquida a posicao antes de chegar no stop. */
export function stopBeyondLiquidation(stop, liquidation, direction) {
  if (liquidation == null || !(stop > 0)) return false;
  return directionSign(direction) * (liquidation - stop) >= 0;
}

/**
 * Cenario de stop para uma posicao: resultado em US$ e em % do capital do
 * plano, movimento do preco ate o stop e o efeito disso na margem, mais a
 * liquidacao aproximada quando ha alavancagem.
 */
export function stopScenario(position, { stopPrice, capitalUsd, leverage = 1, direction }) {
  if (!(position?.quantity > EPS) || !(stopPrice > 0)) return null;
  const s = directionSign(direction);
  const pnlUsd = pnlAt(position, stopPrice, direction);
  const movePct = (s * (stopPrice - position.avgPrice) / position.avgPrice) * 100;
  const liquidation = approxLiquidation(position.avgPrice, leverage, direction);
  return {
    avgPrice: position.avgPrice,
    marginUsd: position.marginUsd,
    quantity: position.quantity,
    pnlUsd,
    pctOfCapital: capitalUsd > 0 ? (pnlUsd / capitalUsd) * 100 : null,
    movePct,
    marginPct: movePct * leverage,
    liquidation,
    stopBeyondLiquidation: stopBeyondLiquidation(stopPrice, liquidation, direction),
  };
}

/**
 * Alvo a partir do preco medio: retorno % no preco e na margem, e
 * risco/retorno = distancia ate o alvo / distancia ate o stop. Sem risco
 * (stop no zero a zero ou no lucro), o risco/retorno fica nulo.
 */
export function targetStats(target, position, { stopPrice, leverage = 1, direction }) {
  const mid = zoneMid(target.zoneFrom, target.zoneTo);
  const avg = position?.avgPrice;
  if (!(avg > 0) || !(mid > 0)) return { mid, returnPct: null, returnPctMargin: null, rr: null, pnlUsd: null };
  const s = directionSign(direction);
  const reward = s * (mid - avg);
  const risk = stopPrice > 0 ? s * (avg - stopPrice) : 0;
  const returnPct = (reward / avg) * 100;
  return {
    mid,
    returnPct,
    returnPctMargin: returnPct * leverage,
    rr: risk > EPS ? reward / risk : null,
    pnlUsd: pnlAt(position, mid, direction),
  };
}

/**
 * Resultado realizado: a posicao e formada so pelas entradas preenchidas
 * (preco executado) e cada saida fecha uma fracao dela. O % e sobre a
 * margem dessas entradas.
 */
export function realizedResult(entries, exits, leverage, direction) {
  const filled = entries.filter(isFilled);
  if (!filled.length || !exits.length) return null;
  const position = aggregate(filled, leverage);
  if (!(position.quantity > EPS)) return null;
  const s = directionSign(direction);
  let pnlUsd = 0;
  let closedFraction = 0;
  const legs = exits.map((x) => {
    const legPnl = s * x.fraction * position.quantity * (x.price - position.avgPrice);
    pnlUsd += legPnl;
    closedFraction += x.fraction;
    return { ...x, pnlUsd: legPnl };
  });
  return {
    marginUsd: position.marginUsd,
    avgPrice: position.avgPrice,
    quantity: position.quantity,
    closedFraction,
    pnlUsd,
    pnlPct: position.marginUsd > 0 ? (pnlUsd / position.marginUsd) * 100 : null,
    exits: legs,
  };
}

/** Todos os numeros de um plano, prontos para a tela. */
export function analyzePlan(plan) {
  const { direction, stopPrice, capitalUsd } = plan;
  const leverage = plan.leverage > 0 ? plan.leverage : 1;
  const ctx = { stopPrice, capitalUsd, leverage, direction };
  const s = directionSign(direction);

  const ordered = fillOrder(plan.entries || [], direction);
  const all = aggregate(ordered, leverage);
  const firstOnly = ordered.length ? aggregate([ordered[0]], leverage) : null;

  const entries = ordered.map((e, i) => {
    const price = entryPrice(e);
    return {
      ...e,
      order: i + 1,
      mid: zoneMid(e.zoneFrom, e.zoneTo),
      price,
      filled: isFilled(e),
      quantity: price > 0 ? (e.amountUsd * leverage) / price : null,
      toStopPct: stopPrice > 0 && price > 0 ? (s * (price - stopPrice) / price) * 100 : null,
    };
  });

  const targets = targetOrder(plan.targets || [], direction).map((t, i) => ({
    ...t,
    order: i + 1,
    ...targetStats(t, all, ctx),
  }));

  return {
    avgPrice: all.avgPrice,
    entriesUsd: all.marginUsd,
    notionalUsd: all.notionalUsd,
    quantity: all.quantity,
    entries,
    targets,
    ifAllFilled: stopScenario(all, ctx),
    ifFirstOnly: stopScenario(firstOnly, ctx),
    realized: realizedResult(plan.entries || [], plan.exits || [], leverage, direction),
  };
}

/** Totais da tela inicial: resultado realizado acumulado, encerrados e taxa de acerto. */
export function journalSummary(plans) {
  const closed = plans.filter((p) => p.status === 'encerrado');
  const withResult = closed.filter((p) => p.calc?.realized);
  const wins = withResult.filter((p) => p.calc.realized.pnlUsd > 0);
  return {
    closedCount: closed.length,
    withResultCount: withResult.length,
    winCount: wins.length,
    hitRatePct: withResult.length ? (wins.length / withResult.length) * 100 : null,
    realizedTotalUsd: withResult.reduce((sum, p) => sum + p.calc.realized.pnlUsd, 0),
  };
}
