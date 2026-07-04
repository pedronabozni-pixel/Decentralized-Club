// ==========================================================================
//  Precos em TEMPO REAL via WebSocket publico da Binance (sem chave).
//  Stream miniTicker: um tick por segundo por moeda, direto no navegador —
//  sem passar pelo backend, latencia minima e custo zero de servidor.
//  Exposto como window.Realtime.
// ==========================================================================
(function () {
  const WS_BASE = 'wss://stream.binance.com:9443/stream';

  let ws = null;
  let gen = 0; // geracao da conexao: invalida reconexoes de conexoes antigas

  /**
   * Conecta (ou reconecta) ao stream das moedas informadas.
   * onTick(symbol, priceUsdt, change24hPct) a cada atualizacao.
   * onStatus(connected: boolean) quando o estado da conexao muda.
   */
  function connect(symbols, onTick, onStatus) {
    const syms = [...new Set(symbols.map((s) => String(s).toLowerCase()))].filter(Boolean);
    stop();
    if (!syms.length) return;
    gen += 1;
    open(syms, gen, 0, onTick, onStatus);
  }

  function open(syms, myGen, retry, onTick, onStatus) {
    if (myGen !== gen) return; // conexao superada por outra mais nova
    const streams = syms.map((s) => `${s}usdt@miniTicker`).join('/');
    ws = new WebSocket(`${WS_BASE}?streams=${streams}`);

    ws.onopen = () => { if (myGen === gen && onStatus) onStatus(true); };

    ws.onmessage = (ev) => {
      if (myGen !== gen) return;
      try {
        const msg = JSON.parse(ev.data);
        const d = msg.data;
        if (d && d.e === '24hrMiniTicker') {
          const symbol = d.s.replace(/USDT$/, '');
          const price = Number(d.c);
          const change24h = Number(d.o) > 0 ? ((price / Number(d.o)) - 1) * 100 : 0;
          onTick(symbol, price, change24h);
        }
      } catch { /* mensagem invalida: ignora */ }
    };

    ws.onclose = () => {
      if (myGen !== gen) return; // fechamento intencional ou conexao antiga
      if (onStatus) onStatus(false);
      const delay = Math.min(15000, 1000 * Math.pow(2, retry)); // backoff exponencial
      setTimeout(() => open(syms, myGen, retry + 1, onTick, onStatus), delay);
    };

    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
  }

  function stop() {
    gen += 1; // invalida callbacks pendentes da conexao atual
    if (ws) { try { ws.close(); } catch { /* noop */ } ws = null; }
  }

  window.Realtime = { connect, stop };
})();
