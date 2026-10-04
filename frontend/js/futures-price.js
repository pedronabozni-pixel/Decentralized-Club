// ==========================================================================
//  Preco atual da Binance Futures (perpetuos), buscado direto pelo navegador
//  em fapi.binance.com, API publica sem chave. O servidor nao chama a
//  Binance: ele roda nos EUA, de onde a Binance costuma bloquear o acesso.
//  Exposto como window.FuturesPrice.
// ==========================================================================
(function () {
  const URL_PRICE = 'https://fapi.binance.com/fapi/v1/ticker/price';

  async function fetchJson(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Binance Futures HTTP ${res.status}`);
    return res.json();
  }

  /** Preco de um par (ex: "MANTAUSDT"). null se o par nao existe ou a Binance nao respondeu. */
  async function get(symbol) {
    try {
      const data = await fetchJson(`${URL_PRICE}?symbol=${encodeURIComponent(symbol)}`);
      const price = Number(data.price);
      return price > 0 ? price : null;
    } catch {
      return null;
    }
  }

  /** Todos os pares numa chamada so: Map("MANTAUSDT" -> 0.0575). null se falhar. */
  async function getAll() {
    try {
      const rows = await fetchJson(URL_PRICE);
      return new Map(rows.map((r) => [r.symbol, Number(r.price)]));
    } catch {
      return null;
    }
  }

  /**
   * Busca agora e repete a cada `ms` (padrao 15 s), chamando onUpdate(Map|null).
   * Retorna uma funcao que encerra o ciclo.
   */
  function watch(onUpdate, ms = 15000) {
    let stopped = false;
    let timer = null;
    const tick = async () => {
      const map = await getAll();
      if (stopped) return;
      onUpdate(map);
      timer = setTimeout(tick, ms);
    };
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }

  window.FuturesPrice = { get, getAll, watch };
})();
