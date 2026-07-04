// ==========================================================================
//  Integracao CoinMarketCap (OPCIONAL - exige COINMARKETCAP_API_KEY no .env).
//  Usada como fonte de fallback quando CoinGecko/Binance nao respondem.
//  Docs: https://coinmarketcap.com/api/documentation/v1/
// ==========================================================================
import { cache } from './cache.js';
import { config } from '../config.js';

const BASE = 'https://pro-api.coinmarketcap.com';

export function hasCmcKey() {
  return Boolean(config.coinmarketcapKey);
}

/**
 * Cotacoes em USD para uma lista de simbolos (ex: ["BTC","ETH"]).
 * Retorna { BTC: { usd, change24h }, ... }. Vazio se nao houver key.
 */
export async function getCmcQuotes(symbols) {
  if (!hasCmcKey() || !symbols.length) return {};
  const key = `cmc_quotes_${symbols.slice().sort().join(',')}`;
  return cache.getOrSet(key, config.cache.priceTtlSeconds, async () => {
    try {
      const url = `${BASE}/v2/cryptocurrency/quotes/latest?symbol=${symbols.join(',')}&convert=USD`;
      const res = await fetch(url, {
        headers: { 'X-CMC_PRO_API_KEY': config.coinmarketcapKey },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`CoinMarketCap HTTP ${res.status}`);
      const data = await res.json();
      const out = {};
      for (const sym of symbols) {
        // A v2 retorna um array por simbolo (moedas homonimas); usa a primeira.
        const entry = Array.isArray(data.data?.[sym]) ? data.data[sym][0] : data.data?.[sym];
        const quote = entry?.quote?.USD;
        if (quote) {
          out[sym] = { usd: quote.price, change24h: quote.percent_change_24h ?? 0 };
        }
      }
      return out;
    } catch (err) {
      console.warn('[coinmarketcap] cotacoes indisponiveis:', err.message);
      return {};
    }
  });
}
