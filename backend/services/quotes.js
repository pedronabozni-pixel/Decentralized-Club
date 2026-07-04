// ==========================================================================
//  Cotacoes para ativos de bolsa, moedas e ouro.
//  - B3 e internacional: Yahoo Finance (endpoint publico, sem chave)
//  - Moedas e ouro (XAU): AwesomeAPI (gratis, sem chave)
//  Toda falha degrada com graca: retorna null e o ativo usa o valor manual.
// ==========================================================================
import { cache } from './cache.js';
import { config } from '../config.js';
import { getUsdBrl } from './dollar.js';

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * Preco atual de um ticker via Yahoo Finance.
 * Retorna { price, currency } ou null. Ex: PETR4.SA -> { price, 'BRL' },
 * AAPL -> { price, 'USD' }.
 */
async function yahooQuote(symbol) {
  const key = `yh_${symbol}`;
  return cache.getOrSet(key, config.cache.priceTtlSeconds * 4, async () => {
    try {
      const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DecentralizedClub/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
      const data = await res.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) return null;
      return { price: meta.regularMarketPrice, currency: meta.currency || 'USD' };
    } catch (err) {
      console.warn(`[quotes] Yahoo ${symbol} indisponivel:`, err.message);
      return null;
    }
  });
}

/** Cotacao de moeda/metal em BRL via AwesomeAPI (ex: EUR, GBP, XAU). */
async function awesomeQuote(code) {
  const key = `awe_${code}`;
  return cache.getOrSet(key, config.cache.priceTtlSeconds * 4, async () => {
    try {
      const pair = `${code.toUpperCase()}-BRL`;
      const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pair}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`AwesomeAPI HTTP ${res.status}`);
      const data = await res.json();
      const quote = data[pair.replace('-', '')];
      return quote ? { price: Number(quote.bid), currency: 'BRL' } : null;
    } catch (err) {
      console.warn(`[quotes] AwesomeAPI ${code} indisponivel:`, err.message);
      return null;
    }
  });
}

/**
 * Preco unitario EM BRL para um ativo, conforme o tipo de cotacao.
 * quoteType: 'b3' | 'us' | 'fx' | 'gold' | 'manual'.
 * Retorna { priceBrl, source } ou null (sem cotacao -> usar valor manual).
 */
export async function getAssetPriceBrl(quoteType, ticker) {
  if (!ticker || quoteType === 'manual') return null;
  const t = ticker.trim().toUpperCase();

  if (quoteType === 'b3') {
    const q = await yahooQuote(t.endsWith('.SA') ? t : `${t}.SA`);
    return q ? { priceBrl: q.price, source: 'yahoo-b3' } : null;
  }

  if (quoteType === 'us') {
    const q = await yahooQuote(t);
    if (!q) return null;
    if (q.currency === 'BRL') return { priceBrl: q.price, source: 'yahoo' };
    const usd = await getUsdBrl();
    return { priceBrl: q.price * usd.rate, source: 'yahoo-usd' };
  }

  if (quoteType === 'fx') {
    const q = await awesomeQuote(t);
    return q ? { priceBrl: q.price, source: 'awesomeapi' } : null;
  }

  if (quoteType === 'gold') {
    const q = await awesomeQuote('XAU');
    return q ? { priceBrl: q.price, source: 'awesomeapi-xau' } : null;
  }

  return null;
}
