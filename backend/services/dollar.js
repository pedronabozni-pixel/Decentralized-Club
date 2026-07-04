// ==========================================================================
//  Cotacao USD/BRL em tempo real via AwesomeAPI (gratis, sem chave).
//  https://economia.awesomeapi.com.br/json/last/USD-BRL
// ==========================================================================
import { cache } from './cache.js';
import { config } from '../config.js';

const CACHE_KEY = 'usd_brl';

export async function getUsdBrl() {
  return cache.getOrSet(CACHE_KEY, config.cache.priceTtlSeconds, async () => {
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`AwesomeAPI HTTP ${res.status}`);
      const data = await res.json();
      const quote = data.USDBRL;
      return {
        rate: Number(quote.bid),
        high: Number(quote.high),
        low: Number(quote.low),
        pctChange: Number(quote.pctChange),
        updatedAt: new Date(Number(quote.timestamp) * 1000).toISOString(),
        source: 'awesomeapi',
      };
    } catch (err) {
      // Fallback conservador para nao derrubar o dashboard se a API cair.
      console.warn('[dollar] falha ao buscar USD/BRL:', err.message);
      return { rate: 5.0, high: 5.0, low: 5.0, pctChange: 0, updatedAt: null, source: 'fallback' };
    }
  });
}
