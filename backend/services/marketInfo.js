// ==========================================================================
//  Central de informacoes de mercado (todas as fontes gratis, sem chave):
//  - Indices e commodities: Yahoo Finance (^BVSP, ^GSPC, ^IXIC, GC=F, BZ=F)
//  - Acoes B3 em destaque: Yahoo (.SA)
//  - Top criptos + trending: CoinGecko
//  - Fear & Greed Index: alternative.me
//  - Macro Brasil: BCB SGS (SELIC ja existe; IPCA 12m serie 433)
// ==========================================================================
import { cache } from './cache.js';
import { getUsdBrl } from './dollar.js';

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; DecentralizedClub/1.0)' };

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Cotacao Yahoo com variacao do dia (preco vs fechamento anterior). */
async function yahooTicker(symbol) {
  return cache.getOrSet(`mi_yq_${symbol}`, 120, async () => {
    try {
      const data = await fetchJson(`${YAHOO}/${encodeURIComponent(symbol)}?interval=1d&range=2d`, UA);
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) return null;
      const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
      return {
        price: meta.regularMarketPrice,
        currency: meta.currency || 'USD',
        changePct: prev ? ((meta.regularMarketPrice / prev) - 1) * 100 : 0,
      };
    } catch (err) {
      console.warn(`[marketInfo] yahoo ${symbol}:`, err.message);
      return null;
    }
  });
}

// ---- Indices e commodities ------------------------------------------------
const INDICES = [
  { key: 'ibov', symbol: '^BVSP', label: 'Ibovespa', kind: 'pts' },
  { key: 'sp500', symbol: '^GSPC', label: 'S&P 500', kind: 'pts' },
  { key: 'nasdaq', symbol: '^IXIC', label: 'Nasdaq', kind: 'pts' },
  { key: 'ouro', symbol: 'GC=F', label: 'Ouro (oz)', kind: 'usd' },
  { key: 'petroleo', symbol: 'BZ=F', label: 'Petroleo Brent', kind: 'usd' },
];

export async function getIndices() {
  const rows = await Promise.all(INDICES.map(async (i) => {
    const q = await yahooTicker(i.symbol);
    return q ? { ...i, price: q.price, changePct: q.changePct } : null;
  }));
  return rows.filter(Boolean);
}

// ---- Historico de um indice (grafico principal) ---------------------------
const RANGE_MAP = { '1m': '1mo', '6m': '6mo', '1a': '1y' };

export async function getIndexHistory(key, range = '6m') {
  const idx = INDICES.find((i) => i.key === key);
  if (!idx) return null;
  const yr = RANGE_MAP[range] || '6mo';
  return cache.getOrSet(`mi_hist_${key}_${yr}`, 900, async () => {
    try {
      const data = await fetchJson(
        `${YAHOO}/${encodeURIComponent(idx.symbol)}?interval=1d&range=${yr}`, UA
      );
      const r = data.chart?.result?.[0];
      const closes = r?.indicators?.quote?.[0]?.close || [];
      const stamps = r?.timestamp || [];
      const points = stamps
        .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), value: closes[i] }))
        .filter((p) => p.value != null);
      return { key, label: idx.label, kind: idx.kind, points };
    } catch (err) {
      console.warn(`[marketInfo] hist ${key}:`, err.message);
      return { key, label: idx.label, kind: idx.kind, points: [] };
    }
  });
}

// ---- Acoes B3 em destaque -------------------------------------------------
const B3_BLUECHIPS = [
  { ticker: 'PETR4', name: 'Petrobras' },
  { ticker: 'VALE3', name: 'Vale' },
  { ticker: 'ITUB4', name: 'Itau' },
  { ticker: 'BBDC4', name: 'Bradesco' },
  { ticker: 'WEGE3', name: 'WEG' },
  { ticker: 'B3SA3', name: 'B3' },
];

export async function getB3Highlights() {
  const rows = await Promise.all(B3_BLUECHIPS.map(async (s) => {
    const q = await yahooTicker(`${s.ticker}.SA`);
    return q ? { ...s, price: q.price, changePct: q.changePct } : null;
  }));
  return rows.filter(Boolean);
}

// Busca CoinGecko com 1 retry no rate limit; nunca cacheia resposta vazia.
async function coingeckoResilient(cacheKey, ttl, url, mapFn) {
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const data = await fetchJson(url);
      const out = mapFn(data);
      if (out.length) cache.set(cacheKey, out, ttl);
      return out;
    } catch (err) {
      const isRateLimit = String(err.message).includes('429');
      console.warn(`[marketInfo] ${cacheKey} tentativa ${attempt}:`, err.message);
      if (isRateLimit && attempt === 1) {
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      return [];
    }
  }
  return [];
}

// ---- Top criptos ----------------------------------------------------------
// Fonte primaria: CoinGecko (market cap real). Se o rate limit derrubar,
// fallback via Binance (ticker 24h + klines de 7 dias), que tem limites
// generosos — a tabela nunca fica vazia.
const BINANCE_TOP = [
  { symbol: 'BTC', name: 'Bitcoin' }, { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'XRP', name: 'XRP' }, { symbol: 'BNB', name: 'BNB' },
  { symbol: 'SOL', name: 'Solana' }, { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' }, { symbol: 'TRX', name: 'TRON' },
  { symbol: 'LINK', name: 'Chainlink' }, { symbol: 'AVAX', name: 'Avalanche' },
];

async function topCryptosViaBinance() {
  const usd = await getUsdBrl();
  const rows = await Promise.all(BINANCE_TOP.map(async (c, idx) => {
    try {
      const [t, k] = await Promise.all([
        fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${c.symbol}USDT`),
        fetchJson(`https://api.binance.com/api/v3/klines?symbol=${c.symbol}USDT&interval=6h&limit=28`),
      ]);
      const closes = k.map((row) => Number(row[4]));
      const change7d = closes.length > 1 ? ((closes[closes.length - 1] / closes[0]) - 1) * 100 : 0;
      return {
        rank: idx + 1,
        symbol: c.symbol,
        name: c.name,
        priceBrl: Number(t.lastPrice) * usd.rate,
        change24h: Number(t.priceChangePercent),
        change7d,
        marketCap: null, // Binance nao fornece; frontend mostra "—"
        sparkline: closes,
      };
    } catch { return null; }
  }));
  return rows.filter(Boolean);
}

export async function getTopCryptos() {
  const url = 'https://api.coingecko.com/api/v3/coins/markets'
    + '?vs_currency=brl&order=market_cap_desc&per_page=10&page=1'
    + '&sparkline=true&price_change_percentage=24h,7d';
  const viaCoingecko = await coingeckoResilient('mi_top_cryptos', 180, url, (data) => data.map((c) => ({
    rank: c.market_cap_rank,
    symbol: (c.symbol || '').toUpperCase(),
    name: c.name,
    priceBrl: c.current_price,
    change24h: c.price_change_percentage_24h_in_currency ?? 0,
    change7d: c.price_change_percentage_7d_in_currency ?? 0,
    marketCap: c.market_cap,
    // Reamostra o sparkline (168 pontos horarios) para ~28 pontos.
    sparkline: (c.sparkline_in_7d?.price || []).filter((_, i) => i % 6 === 0),
  })));
  if (viaCoingecko.length) return viaCoingecko;

  // Fallback Binance (cacheado tambem, para nao martelar em cada refresh).
  const cached = cache.get('mi_top_binance');
  if (cached) return cached;
  const viaBinance = await topCryptosViaBinance();
  if (viaBinance.length) cache.set('mi_top_binance', viaBinance, 180);
  return viaBinance;
}

// ---- Trending (CoinGecko) -------------------------------------------------
export async function getTrending() {
  return coingeckoResilient('mi_trending', 600,
    'https://api.coingecko.com/api/v3/search/trending',
    (data) => (data.coins || []).slice(0, 7).map((c) => ({
      symbol: (c.item?.symbol || '').toUpperCase(),
      name: c.item?.name,
      rank: c.item?.market_cap_rank,
    })));
}

// ---- Fear & Greed Index (alternative.me) ----------------------------------
const FNG_LABELS = {
  'Extreme Fear': 'Medo extremo',
  'Fear': 'Medo',
  'Neutral': 'Neutro',
  'Greed': 'Ganancia',
  'Extreme Greed': 'Ganancia extrema',
};

export async function getFearGreed() {
  return cache.getOrSet('mi_fng', 1800, async () => {
    try {
      const data = await fetchJson('https://api.alternative.me/fng/?limit=30');
      const rows = data.data || [];
      if (!rows.length) return null;
      const series = rows
        .map((r) => ({ value: Number(r.value), date: new Date(Number(r.timestamp) * 1000).toISOString().slice(0, 10) }))
        .reverse();
      return {
        value: Number(rows[0].value),
        label: FNG_LABELS[rows[0].value_classification] || rows[0].value_classification,
        series,
      };
    } catch (err) {
      console.warn('[marketInfo] fear&greed:', err.message);
      return null;
    }
  });
}

// ---- IPCA acumulado 12 meses (BCB serie 433) ------------------------------
export async function getIpca12m() {
  return cache.getOrSet('mi_ipca', 6 * 3600, async () => {
    try {
      const data = await fetchJson(
        'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json'
      );
      const acc = data.reduce((f, row) => f * (1 + Number(row.valor) / 100), 1);
      return { value: (acc - 1) * 100, lastMonth: data[data.length - 1]?.data || null };
    } catch (err) {
      console.warn('[marketInfo] ipca:', err.message);
      return null;
    }
  });
}

// ---- Euro em BRL (er-api cruzado, cacheado) -------------------------------
export async function getEurBrl() {
  return cache.getOrSet('mi_eur', 300, async () => {
    try {
      const data = await fetchJson('https://open.er-api.com/v6/latest/USD');
      const brl = Number(data?.rates?.BRL);
      const eur = Number(data?.rates?.EUR);
      if (brl && eur) return brl / eur;
    } catch (err) {
      console.warn('[marketInfo] eur:', err.message);
    }
    const usd = await getUsdBrl();
    return usd.rate * 1.08; // aproximacao de ultimo recurso
  });
}
