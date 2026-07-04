// ==========================================================================
//  Integracao Binance (API publica REST, sem chave).
//  Usada como fonte alternativa de preco spot em USDT.
//  Para converter em BRL, multiplique pelo USD/BRL (services/dollar.js).
//  WebSocket em tempo real fica para a Fase 2 (stream de precos no front).
//  Docs: https://binance-docs.github.io/apidocs/spot/en/
// ==========================================================================
import { cache } from './cache.js';
import { config } from '../config.js';

const BASE = 'https://api.binance.com';

/**
 * Precos spot em USDT para uma lista de simbolos (ex: ["BTC","ETH"]).
 * Retorna { BTC: 67000.12, ETH: 3500.5, ... } em USDT.
 */
export async function getSpotUsdt(symbols) {
  if (!symbols.length) return {};
  const key = `bnc_spot_${symbols.slice().sort().join(',')}`;
  return cache.getOrSet(key, config.cache.priceTtlSeconds, async () => {
    try {
      const res = await fetch(`${BASE}/api/v3/ticker/price`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
      const all = await res.json(); // [{symbol:'BTCUSDT', price:'...'}, ...]
      const wanted = new Set(symbols.map((s) => `${s.toUpperCase()}USDT`));
      const out = {};
      for (const row of all) {
        if (wanted.has(row.symbol)) {
          const sym = row.symbol.replace(/USDT$/, '');
          out[sym] = Number(row.price);
        }
      }
      return out;
    } catch (err) {
      console.warn('[binance] precos indisponiveis:', err.message);
      return {};
    }
  });
}
