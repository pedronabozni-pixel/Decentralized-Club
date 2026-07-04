// ==========================================================================
//  Agregador de precos multi-fonte com fallback em cascata:
//    1. CoinGecko (primaria — BRL/USD direto + variacao 24h)
//    2. Binance spot USDT x cotacao do dolar (AwesomeAPI)
//    3. CoinMarketCap (se COINMARKETCAP_API_KEY estiver no .env)
//  Assim o dashboard continua funcionando mesmo se uma fonte cair.
// ==========================================================================
import { getPrices as getCoingeckoPrices } from './coingecko.js';
import { getSpotUsdt } from './binance.js';
import { getCmcQuotes, hasCmcKey } from './coinmarketcap.js';
import { getUsdBrl } from './dollar.js';

/**
 * Precos unificados para uma lista de simbolos.
 * Retorna { BTC: { brl, usd, change24h, source }, ... }
 */
export async function getUnifiedPrices(symbols) {
  const wanted = [...new Set(symbols.map((s) => s.toUpperCase()))];
  if (!wanted.length) return {};

  // Fonte 1: CoinGecko.
  const cg = await getCoingeckoPrices(wanted);
  const out = {};
  for (const sym of wanted) {
    if (cg[sym]?.brl > 0) {
      out[sym] = { ...cg[sym], source: 'coingecko' };
    }
  }

  // Fonte 2: Binance (USDT -> BRL via dolar) para o que faltou.
  let missing = wanted.filter((s) => !out[s]);
  if (missing.length) {
    const [binance, usd] = await Promise.all([getSpotUsdt(missing), getUsdBrl()]);
    for (const sym of missing) {
      if (binance[sym] > 0) {
        out[sym] = {
          brl: binance[sym] * usd.rate,
          usd: binance[sym],
          change24h: 0,
          source: 'binance',
        };
      }
    }
  }

  // Fonte 3: CoinMarketCap (opcional) para o que ainda faltou.
  missing = wanted.filter((s) => !out[s]);
  if (missing.length && hasCmcKey()) {
    const [cmc, usd] = await Promise.all([getCmcQuotes(missing), getUsdBrl()]);
    for (const sym of missing) {
      if (cmc[sym]?.usd > 0) {
        out[sym] = {
          brl: cmc[sym].usd * usd.rate,
          usd: cmc[sym].usd,
          change24h: cmc[sym].change24h,
          source: 'coinmarketcap',
        };
      }
    }
  }

  return out;
}
