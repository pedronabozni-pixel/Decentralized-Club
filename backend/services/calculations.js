// ==========================================================================
//  Calculos financeiros puros (sem I/O). Faceis de testar isoladamente.
// ==========================================================================

/** Preco medio = soma gasto / soma quantidade. */
export function averagePrice(totalSpent, totalQuantity) {
  if (!totalQuantity) return 0;
  return totalSpent / totalQuantity;
}

/** Ganho/Perda em R$ = (preco atual - preco medio) * quantidade. */
export function gainLoss(currentPrice, avgPrice, quantity) {
  return (currentPrice - avgPrice) * quantity;
}

/** Variacao percentual entre preco atual e preco medio. */
export function gainLossPercent(currentPrice, avgPrice) {
  if (!avgPrice) return 0;
  return ((currentPrice - avgPrice) / avgPrice) * 100;
}

/**
 * Monta a posicao consolidada de uma cripto a partir da agregacao de compras
 * e do preco atual de mercado. A moeda de referencia e a mesma das compras
 * registradas (cripto usa USD; a consolidacao em BRL fica no portfolio).
 */
export function buildCryptoPosition(position, currentPrice) {
  const avg = averagePrice(position.total_spent, position.total_quantity);
  const currentValue = currentPrice * position.total_quantity;
  return {
    symbol: position.symbol,
    name: position.name || position.symbol,
    quantity: position.total_quantity,
    avgPrice: avg,
    currentPrice,
    totalSpent: position.total_spent,
    currentValue,
    gainLoss: gainLoss(currentPrice, avg, position.total_quantity),
    gainLossPercent: gainLossPercent(currentPrice, avg),
    buyCount: position.buy_count,
  };
}

// ----- Renda fixa ---------------------------------------------------------

/** Numero de dias entre duas datas ISO (>= 0). */
export function daysBetween(fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const ms = to - from;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Aliquota regressiva de IR para renda fixa (CDB, Tesouro, LC, LF...).
 * Isentos: Poupanca, LCI, LCA, CRI, CRA e debentures incentivadas.
 */
export function irRate(days, type = '') {
  const t = String(type).toLowerCase();
  if (t.includes('poupan') || t.includes('lci') || t.includes('lca')
    || t.includes('cri') || t.includes('cra') || t.includes('incentivada')) return 0;
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.20;
  if (days <= 720) return 0.175;
  return 0.15;
}

/**
 * Rendimento composto. `rate` em % a.a., periodo em dias (base 365 corridos).
 * Retorna { gross, ir, irAmount, net, total } — total = principal + net.
 */
export function compoundReturn(principal, annualRatePercent, days, type = '') {
  const years = days / 365;
  const factor = Math.pow(1 + annualRatePercent / 100, years);
  const gross = principal * factor - principal; // rendimento bruto
  const ir = irRate(days, type);
  const irAmount = gross * ir;
  const net = gross - irAmount;
  return {
    principal,
    days,
    grossYield: gross,
    irRate: ir,
    irAmount,
    netYield: net,
    total: principal + net,
  };
}

/** Distribuicao percentual da carteira em BTC / Altcoins / Renda Fixa. */
export function allocation({ btcValue, altcoinsValue, fixedIncomeValue }) {
  const total = btcValue + altcoinsValue + fixedIncomeValue;
  const pct = (v) => (total > 0 ? (v / total) * 100 : 0);
  return {
    total,
    btc: { value: btcValue, percent: pct(btcValue) },
    altcoins: { value: altcoinsValue, percent: pct(altcoinsValue) },
    fixedIncome: { value: fixedIncomeValue, percent: pct(fixedIncomeValue) },
  };
}
