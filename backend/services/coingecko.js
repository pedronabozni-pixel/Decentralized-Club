// ==========================================================================
//  Integracao CoinGecko (gratis, sem chave).
//  - Precos em BRL e USD (direto, sem precisar converter)
//  - Market cap, dominancia do BTC
//  - Lista de moedas para autocomplete
//  Docs: https://www.coingecko.com/en/api/documentation
// ==========================================================================
import { cache } from './cache.js';
import { config } from '../config.js';

const BASE = 'https://api.coingecko.com/api/v3';

// Mapa simbolo -> id da CoinGecko (as principais). Para outras moedas usamos
// a lista completa (cacheada) resolvida sob demanda.
const SYMBOL_TO_ID = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2',
  DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink', LTC: 'litecoin',
  TRX: 'tron', UNI: 'uniswap', ATOM: 'cosmos', XLM: 'stellar',
  USDT: 'tether', USDC: 'usd-coin', SHIB: 'shiba-inu', NEAR: 'near',
};

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  return res.json();
}

/** Lista completa de moedas (id, symbol, name) — cacheada por 1h.
 *  Nao cacheia resposta vazia (falha temporaria nao pode "grudar" por 1h). */
async function coinList() {
  const cached = cache.get('cg_coin_list');
  if (cached) return cached;
  try {
    const list = await fetchJson(`${BASE}/coins/list`);
    if (Array.isArray(list) && list.length) cache.set('cg_coin_list', list, 3600);
    return list || [];
  } catch (err) {
    console.warn('[coingecko] coin list indisponivel:', err.message);
    return [];
  }
}

/** Resolve um simbolo (ex: "SOL") para o id da CoinGecko (ex: "solana").
 *  Usa o /search (ranqueado por market cap) para nao confundir a moeda real
 *  com clones/memes de mesmo simbolo. */
export async function resolveId(symbol) {
  const sym = symbol.toUpperCase();
  if (SYMBOL_TO_ID[sym]) return SYMBOL_TO_ID[sym];
  return cache.getOrSet(`cg_resolve_${sym}`, 3600, async () => {
    try {
      const data = await fetchJson(`${BASE}/search?query=${encodeURIComponent(sym)}`);
      const exact = (data.coins || []).find((c) => c.symbol.toUpperCase() === sym);
      if (exact) return exact.id; // /search vem ordenado por relevancia
    } catch (err) {
      console.warn(`[coingecko] /search falhou p/ ${sym}:`, err.message);
    }
    const list = await coinList();
    const match = list.find((c) => c.symbol.toUpperCase() === sym);
    return match ? match.id : null;
  });
}

/**
 * Precos atuais de varios simbolos em BRL e USD + variacao 24h.
 * Retorna { BTC: { brl, usd, change24h }, ... }.
 */
export async function getPrices(symbols) {
  if (!symbols.length) return {};
  const key = `cg_prices_${symbols.slice().sort().join(',')}`;
  return cache.getOrSet(key, config.cache.priceTtlSeconds, async () => {
    const idBySymbol = {};
    for (const s of symbols) {
      const id = await resolveId(s);
      if (id) idBySymbol[s.toUpperCase()] = id;
    }
    const ids = [...new Set(Object.values(idBySymbol))];
    if (!ids.length) return {};

    const url = `${BASE}/simple/price?ids=${ids.join(',')}`
      + `&vs_currencies=brl,usd&include_24hr_change=true`;
    let data = {};
    try {
      data = await fetchJson(url);
    } catch (err) {
      console.warn('[coingecko] precos indisponiveis:', err.message);
      return {};
    }

    const out = {};
    for (const [sym, id] of Object.entries(idBySymbol)) {
      const row = data[id];
      if (!row) continue;
      out[sym] = {
        brl: row.brl ?? 0,
        usd: row.usd ?? 0,
        change24h: row.brl_24h_change ?? row.usd_24h_change ?? 0,
      };
    }
    return out;
  });
}

/** Dados globais de mercado: dominancia BTC, market cap total. */
export async function getGlobal() {
  return cache.getOrSet('cg_global', 300, async () => {
    try {
      const data = await fetchJson(`${BASE}/global`);
      const g = data.data;
      return {
        btcDominance: g.market_cap_percentage?.btc ?? null,
        totalMarketCapUsd: g.total_market_cap?.usd ?? null,
        marketCapChange24h: g.market_cap_change_percentage_24h_usd ?? null,
      };
    } catch (err) {
      console.warn('[coingecko] global indisponivel:', err.message);
      return { btcDominance: null, totalMarketCapUsd: null, marketCapChange24h: null };
    }
  });
}

/**
 * Serie base de 90 dias por moeda (1 ponto/dia, em BRL), cacheada 30 min.
 * Buscar SEMPRE 90 dias e fatiar localmente evita estourar o rate limit da
 * CoinGecko quando o usuario troca o periodo do grafico (7/30/90).
 * Resposta vazia NAO e cacheada; 429 ganha um retry com pausa.
 */
const CHART_BASE_DAYS = 90;

async function baseChart(sym) {
  const key = `cg_chart_base_${sym}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const id = await resolveId(sym);
  if (!id) return [];

  const url = `${BASE}/coins/${id}/market_chart?vs_currency=brl&days=${CHART_BASE_DAYS}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const data = await fetchJson(url);
      const raw = (data.prices || []).map(([t, price]) => ({ t, price }));
      // Reamostra: mantem o ultimo ponto de cada dia.
      const byDay = new Map();
      for (const p of raw) byDay.set(new Date(p.t).toISOString().slice(0, 10), p);
      const points = [...byDay.values()];
      if (points.length) cache.set(key, points, 1800);
      return points;
    } catch (err) {
      const isRateLimit = String(err.message).includes('429');
      console.warn(`[coingecko] market_chart ${sym} tentativa ${attempt}:`, err.message);
      if (isRateLimit && attempt === 1) {
        await new Promise((r) => setTimeout(r, 2500)); // espera a janela do limite
        continue;
      }
      return [];
    }
  }
  return [];
}

/** Serie diaria dos ultimos `days` dias, fatiada da base de 90. */
export async function getMarketChart(symbol, days = 30) {
  const points = await baseChart(symbol.toUpperCase());
  if (!points.length) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return points.filter((p) => p.t >= cutoff);
}

/** Sugestoes para autocomplete a partir de um termo de busca.
 *  Usa o endpoint /search da CoinGecko, que ja retorna ordenado por
 *  relevancia/market cap (a Solana real vem antes dos memes "Baby Solana"). */
export async function searchCoins(query) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 1) return [];
  return cache.getOrSet(`cg_search_${q}`, 600, async () => {
    try {
      const data = await fetchJson(`${BASE}/search?query=${encodeURIComponent(q)}`);
      return (data.coins || []).slice(0, 15).map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        rank: c.market_cap_rank ?? null,
      }));
    } catch (err) {
      console.warn('[coingecko] /search indisponivel, usando lista local:', err.message);
      // Fallback: filtra a lista completa, priorizando match exato de simbolo.
      const list = await coinList();
      const ql = q.toLowerCase();
      const score = (c) => {
        const sym = c.symbol.toLowerCase();
        const name = c.name.toLowerCase();
        if (sym === ql) return 0;
        if (name === ql) return 1;
        if (sym.startsWith(ql)) return 2;
        if (name.startsWith(ql)) return 3;
        if (name.includes(ql)) return 4;
        return 5;
      };
      return list
        .filter((c) => score(c) < 5)
        .sort((a, b) => score(a) - score(b))
        .slice(0, 15)
        .map((c) => ({ id: c.id, symbol: c.symbol.toUpperCase(), name: c.name, rank: null }));
    }
  });
}
