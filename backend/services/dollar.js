// ==========================================================================
//  Cotacao USD/BRL em tempo real com fallback em cascata:
//    1. AwesomeAPI (https://economia.awesomeapi.com.br) — melhor no Brasil
//    2. open.er-api.com — gratis, sem chave, funciona de qualquer datacenter
//    3. CoinGecko (preco do Tether em BRL ~ dolar)
//    4. Valor fixo 5.0 (ultimo recurso, so para nao derrubar o dashboard)
// ==========================================================================
import { cache } from './cache.js';
import { config } from '../config.js';

const CACHE_KEY = 'usd_brl';

async function fromAwesomeApi() {
  const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`AwesomeAPI HTTP ${res.status}`);
  const data = await res.json();
  const q = data.USDBRL;
  return {
    rate: Number(q.bid),
    high: Number(q.high),
    low: Number(q.low),
    pctChange: Number(q.pctChange),
    updatedAt: new Date(Number(q.timestamp) * 1000).toISOString(),
    source: 'awesomeapi',
  };
}

async function fromErApi() {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`er-api HTTP ${res.status}`);
  const data = await res.json();
  const rate = Number(data?.rates?.BRL);
  if (!rate) throw new Error('er-api sem BRL');
  return {
    rate, high: rate, low: rate, pctChange: 0,
    updatedAt: data.time_last_update_utc || null,
    source: 'er-api',
  };
}

async function fromCoingeckoTether() {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=brl',
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  const rate = Number(data?.tether?.brl);
  if (!rate) throw new Error('CoinGecko sem tether/brl');
  return {
    rate, high: rate, low: rate, pctChange: 0,
    updatedAt: new Date().toISOString(),
    source: 'coingecko-usdt',
  };
}

export async function getUsdBrl() {
  return cache.getOrSet(CACHE_KEY, config.cache.priceTtlSeconds, async () => {
    for (const provider of [fromAwesomeApi, fromErApi, fromCoingeckoTether]) {
      try {
        return await provider();
      } catch (err) {
        console.warn(`[dollar] ${provider.name} falhou:`, err.message);
      }
    }
    // Ultimo recurso: valor conservador para nao derrubar o dashboard.
    console.warn('[dollar] todas as fontes falharam; usando fallback 5.0');
    return { rate: 5.0, high: 5.0, low: 5.0, pctChange: 0, updatedAt: null, source: 'fallback' };
  });
}
