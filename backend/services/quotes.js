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

/**
 * Cotacao de moeda em BRL (ex: EUR, GBP).
 * 1. AwesomeAPI (melhor no Brasil; bloqueia alguns datacenters)
 * 2. open.er-api.com via taxa cruzada: moeda->USD->BRL
 */
async function fxQuoteBrl(code) {
  const c = code.toUpperCase();
  const key = `fx_${c}`;
  return cache.getOrSet(key, config.cache.priceTtlSeconds * 4, async () => {
    // Fonte 1: AwesomeAPI direto em BRL.
    try {
      const pair = `${c}-BRL`;
      const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pair}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        const quote = data[pair.replace('-', '')];
        if (quote) return { price: Number(quote.bid), currency: 'BRL' };
      }
    } catch (err) {
      console.warn(`[quotes] AwesomeAPI ${c} indisponivel:`, err.message);
    }
    // Fonte 2: er-api cruzando com o dolar (funciona em qualquer datacenter).
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`er-api HTTP ${res.status}`);
      const data = await res.json();
      const brlPerUsd = Number(data?.rates?.BRL);
      const codePerUsd = Number(data?.rates?.[c]);
      if (brlPerUsd && codePerUsd) {
        return { price: brlPerUsd / codePerUsd, currency: 'BRL' };
      }
    } catch (err) {
      console.warn(`[quotes] er-api ${c} indisponivel:`, err.message);
    }
    return null;
  });
}

/**
 * Ouro em BRL por onca troy.
 * 1. AwesomeAPI XAU-BRL  2. Yahoo GC=F (futuro do ouro em USD) x dolar
 */
async function goldQuoteBrl() {
  return cache.getOrSet('gold_brl', config.cache.priceTtlSeconds * 4, async () => {
    const viaAwesome = await fxQuoteBrl('XAU');
    if (viaAwesome) return viaAwesome;
    const gc = await yahooQuote('GC=F');
    if (gc?.price) {
      const usd = await getUsdBrl();
      return { price: gc.price * usd.rate, currency: 'BRL' };
    }
    return null;
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
    const q = await fxQuoteBrl(t);
    return q ? { priceBrl: q.price, source: 'fx' } : null;
  }

  if (quoteType === 'gold') {
    const q = await goldQuoteBrl();
    return q ? { priceBrl: q.price, source: 'gold' } : null;
  }

  return null;
}
