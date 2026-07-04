// ==========================================================================
//  Banco Central do Brasil (SGS) — taxa SELIC (gratis, sem chave).
//  Usada como sugestao de taxa no simulador de renda fixa.
//  Serie 432 = meta SELIC (% a.a.).
//  Docs: https://www.bcb.gov.br/estatisticas/sgs
// ==========================================================================
import { cache } from './cache.js';

export async function getSelic() {
  return cache.getOrSet('bcb_selic', 3600, async () => {
    try {
      const url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json';
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`BCB HTTP ${res.status}`);
      const data = await res.json();
      const last = data[data.length - 1];
      return { selic: Number(last.valor), date: last.data, source: 'bcb' };
    } catch (err) {
      console.warn('[bcb] SELIC indisponivel:', err.message);
      return { selic: null, date: null, source: 'fallback' };
    }
  });
}
