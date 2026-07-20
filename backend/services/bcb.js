// ==========================================================================
//  Banco Central do Brasil (SGS) — taxa SELIC (gratis, sem chave).
//  Usada como sugestao de taxa no simulador de renda fixa.
//  Serie 432 = meta SELIC (% a.a.).
//  Docs: https://www.bcb.gov.br/estatisticas/sgs
// ==========================================================================
import { cache } from './cache.js';

/**
 * CDI diario acumulado dos ultimos ~`days` dias (serie SGS 252 dias uteis).
 * Retorna [{ date: 'YYYY-MM-DD', factor }] com factor acumulado desde o
 * primeiro ponto (1.0 no inicio). Usado como benchmark no grafico.
 */
export async function getCdiAccumulated(days = 30) {
  return cache.getOrSet(`bcb_cdi_${days}`, 3600, async () => {
    try {
      // A serie 12 limita `ultimos` a 20 valores; usamos intervalo de datas.
      const fmt = (d) => d.toLocaleDateString('pt-BR'); // DD/MM/YYYY
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days - 3);
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados`
        + `?formato=json&dataInicial=${fmt(start)}&dataFinal=${fmt(end)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`BCB HTTP ${res.status}`);
      const data = await res.json();
      let factor = 1;
      return data.map((row) => {
        factor *= 1 + Number(row.valor) / 100; // valor = % ao dia
        const [d, m, y] = row.data.split('/');
        return { date: `${y}-${m}-${d}`, factor };
      });
    } catch (err) {
      console.warn('[bcb] CDI indisponivel:', err.message);
      return [];
    }
  });
}

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
