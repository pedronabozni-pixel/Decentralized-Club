// ==========================================================================
//  Pagina Mercados — terminal em 4 abas:
//  Visao geral (pulso + destaques + F&G + macro) · Cripto (grafico, top 20,
//  trending) · Bolsa & Indices (grafico, indices, B3) · Cambio & Juros.
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('mercados.html');

  const { fmtBRL, fmtPct, signClass } = window.App;
  const pts = (v, dec = 0) => new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(v || 0);

  let overview = null;
  const chartState = {
    idx: { key: 'ibov', range: '6m', loaded: false },
    crypto: { key: 'btc', range: '6m', loaded: false },
    fx: { key: 'dolar', range: '6m', loaded: false },
  };

  // ---------- Sparkline SVG ----------
  function sparkline(values, { width = 110, height = 30 } = {}) {
    if (!values || values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = width / (values.length - 1);
    const points = values.map((v, i) =>
      `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`
    ).join(' ');
    const up = values[values.length - 1] >= values[0];
    const color = up ? '#5FB98E' : '#D8736B';
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
      style="display:block;margin-left:auto;">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5"
        stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>
    </svg>`;
  }

  const chip = (v) => `<span class="pill ${v >= 0 ? 'up' : 'down'}">${fmtPct(v)}</span>`;

  // ---------- Troca de abas ----------
  document.getElementById('marketTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.range-tab');
    if (!tab) return;
    document.querySelectorAll('#marketTabs .range-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    ['visao', 'cripto', 'bolsa', 'cambio'].forEach((name) => {
      document.getElementById(`tab-${name}`).classList.toggle('hidden', name !== tab.dataset.tab);
    });
    // Graficos carregam na primeira visita da aba.
    if (tab.dataset.tab === 'cripto' && !chartState.crypto.loaded) loadChart('crypto');
    if (tab.dataset.tab === 'bolsa' && !chartState.idx.loaded) loadChart('idx');
    if (tab.dataset.tab === 'cambio' && !chartState.fx.loaded) loadChart('fx');
  });

  // ---------- Overview ----------
  async function load() {
    try {
      overview = await window.API.marketOverview();
    } catch (err) {
      window.App.toast(err.message || 'Falha ao carregar mercados.', 'error');
      return;
    }
    renderTicker(overview.macro);
    renderPulse(overview);
    renderMovers(overview.movers);
    renderFearGreed(overview.fearGreed);
    renderMacro(overview.macro);
    renderCryptoStats(overview.cryptoGlobal, overview.fearGreed);
    renderCryptos(overview.cryptos);
    renderTrending(overview.trending);
    renderIndices(overview.indices);
    renderB3(overview.b3);
    renderFx(overview.fx);
    renderRates(overview.macro);
  }

  function renderTicker(m) {
    document.getElementById('macroTicker').innerHTML = `
      USD/BRL <strong class="text-gold">R$ ${m.usdBrl?.toFixed(3) ?? '—'}</strong>
      <span class="${m.usdChangePct >= 0 ? 'positive' : 'negative'}">(${fmtPct(m.usdChangePct)})</span><br>
      SELIC <strong>${m.selic != null ? Number(m.selic).toFixed(2) + '%' : '—'}</strong>
      · IPCA 12m <strong>${m.ipca12m != null ? m.ipca12m.toFixed(2) + '%' : '—'}</strong>`;
  }

  // ---------- Visao geral ----------
  function renderPulse(d) {
    const byKey = Object.fromEntries(d.indices.map((i) => [i.key, i]));
    const btc = d.cryptos.find((c) => c.symbol === 'BTC');
    const cards = [
      byKey.ibov && { label: 'Ibovespa', value: pts(byKey.ibov.price), pct: byKey.ibov.changePct },
      byKey.sp500 && { label: 'S&P 500', value: pts(byKey.sp500.price), pct: byKey.sp500.changePct },
      btc && { label: 'Bitcoin', value: fmtBRL(btc.priceBrl), pct: btc.change24h },
    ].filter(Boolean);
    document.getElementById('pulseRow').innerHTML = cards.map((c) => `
      <div class="card stat">
        <div class="label">${c.label}</div>
        <div class="stat-value" style="font-size:24px;">${c.value}</div>
        <div class="delta">${chip(c.pct)}</div>
      </div>`).join('');
  }

  function renderMovers(m) {
    if (!m) return;
    const col = (title, list, cls) => `
      <div>
        <div class="label" style="font:600 10px var(--font-sans);letter-spacing:.18em;color:var(--text-3);text-transform:uppercase;margin-bottom:12px;">${title}</div>
        ${list.map((x) => `
          <div class="flex items-center justify-between" style="padding:9px 0;border-bottom:1px solid var(--line-row);">
            <div class="asset">
              <span class="sym-badge" style="width:30px;height:30px;">${x.symbol.slice(0, 4)}</span>
              <div><div class="nm" style="font-size:12.5px;">${x.name}</div>
              <div class="sub">${x.type}</div></div>
            </div>
            <span class="${cls}" style="font-weight:600;font-size:12.5px;">${fmtPct(x.changePct)}</span>
          </div>`).join('')}
      </div>`;
    document.getElementById('moversGrid').innerHTML =
      col('Maiores altas', m.gainers, 'positive') + col('Maiores baixas', m.losers, 'negative');
  }

  function renderFearGreed(f) {
    const body = document.getElementById('fngBody');
    body.classList.remove('skeleton');
    if (!f) { body.innerHTML = '<div class="empty" style="padding:16px;">Indisponivel agora.</div>'; return; }
    const pos = Math.min(100, Math.max(0, f.value));
    body.innerHTML = `
      <div class="flex items-center justify-between" style="margin-top:4px;">
        <span style="font:500 44px var(--font-serif);line-height:1;">${f.value}</span>
        <span class="text-gold" style="font:italic 500 16px var(--font-serif);">${f.label}</span>
      </div>
      <div style="position:relative;height:6px;border-radius:3px;margin-top:14px;
        background:linear-gradient(90deg,#D8736B,#C4B590,#5FB98E);">
        <span style="position:absolute;top:50%;left:${pos}%;transform:translate(-50%,-50%);
          width:12px;height:12px;border-radius:50%;background:#E4CD96;
          border:2px solid #14130F;box-shadow:0 0 0 1px rgba(201,169,97,.6);"></span>
      </div>
      <div class="flex justify-between text-muted" style="font-size:9.5px;margin-top:6px;letter-spacing:.1em;">
        <span>MEDO</span><span>GANANCIA</span>
      </div>
      <div style="margin-top:10px;">${sparkline(f.series.map((s) => s.value), { width: 250, height: 26 })}</div>`;
  }

  function renderMacro(m) {
    const body = document.getElementById('macroBody');
    body.classList.remove('skeleton');
    const row = (label, value) => `
      <div class="flex justify-between" style="padding:8px 0;border-bottom:1px solid var(--line-row);">
        <span class="text-muted" style="font-size:12.5px;">${label}</span>
        <strong style="font-variant-numeric:tabular-nums;">${value}</strong>
      </div>`;
    body.innerHTML =
      row('SELIC', m.selic != null ? `${Number(m.selic).toFixed(2)}% a.a.` : '—') +
      row('IPCA acumulado 12m', m.ipca12m != null ? `${m.ipca12m.toFixed(2)}%` : '—') +
      row('Dolar', `R$ ${m.usdBrl?.toFixed(3) ?? '—'}`) +
      row('Euro', `R$ ${m.eurBrl?.toFixed(3) ?? '—'}`);
  }

  // ---------- Cripto ----------
  function renderCryptoStats(g, f) {
    const capTri = g?.totalMarketCapUsd ? `US$ ${(g.totalMarketCapUsd / 1e12).toFixed(2)} tri` : '—';
    document.getElementById('cryptoStats').innerHTML = `
      <div class="card stat">
        <div class="label">Mercado cripto global</div>
        <div class="stat-value" style="font-size:24px;">${capTri}</div>
        <div class="delta">${g?.marketCapChange24h != null ? chip(g.marketCapChange24h) : ''}</div>
      </div>
      <div class="card stat">
        <div class="label">Dominancia do Bitcoin</div>
        <div class="stat-value" style="font-size:24px;">${g?.btcDominance ? g.btcDominance.toFixed(1) + '%' : '—'}</div>
        <div class="delta text-muted">participacao no mercado total</div>
      </div>
      <div class="card stat">
        <div class="label">Sentimento (Fear &amp; Greed)</div>
        <div class="stat-value" style="font-size:24px;">${f ? f.value : '—'}</div>
        <div class="delta text-gold" style="font:italic 500 14px var(--font-serif);">${f ? f.label : ''}</div>
      </div>`;
    if (g?.btcDominance) {
      document.getElementById('globalHint').textContent =
        `Dominancia BTC ${g.btcDominance.toFixed(1)}% · mercado ${fmtPct(g.marketCapChange24h)} em 24h`;
    }
  }

  function renderCryptos(list) {
    const tbody = document.getElementById('cryptoTable');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Indisponivel agora.</td></tr>'; return; }
    const cap = (v) => v == null ? '—'
      : (v >= 1e12 ? `R$ ${(v / 1e12).toFixed(2)} tri` : `R$ ${(v / 1e9).toFixed(1)} bi`);
    tbody.innerHTML = list.map((c) => `
      <tr>
        <td class="text-muted">${c.rank}</td>
        <td><div class="asset">
          <span class="sym-badge">${c.symbol.slice(0, 4)}</span>
          <div><div class="nm">${c.name}</div><div class="sub">${c.symbol}</div></div>
        </div></td>
        <td class="num cell-value">${fmtBRL(c.priceBrl)}</td>
        <td class="num ${signClass(c.change24h)}">${fmtPct(c.change24h)}</td>
        <td class="num ${signClass(c.change7d)}">${fmtPct(c.change7d)}</td>
        <td class="num text-muted">${cap(c.marketCap)}</td>
        <td class="num">${sparkline(c.sparkline)}</td>
      </tr>`).join('');
  }

  function renderTrending(list) {
    const el = document.getElementById('trendingList');
    if (!list.length) { el.innerHTML = '<span class="text-muted">Indisponivel agora.</span>'; return; }
    el.innerHTML = list.map((t) => `
      <span class="range-tab" style="cursor:default;">
        <strong class="text-gold">${t.symbol}</strong>&nbsp;${t.name}${t.rank ? `&nbsp;<span class="text-muted">#${t.rank}</span>` : ''}
      </span>`).join('');
  }

  // ---------- Bolsa ----------
  function renderIndices(indices) {
    const order = ['ibov', 'sp500', 'nasdaq', 'dow', 'vix', 'ouro', 'petroleo'];
    const byKey = Object.fromEntries(indices.map((i) => [i.key, i]));
    document.getElementById('indicesRow').innerHTML = order.map((k) => {
      const i = byKey[k];
      if (!i) return '';
      const value = i.kind === 'usd' ? 'US$ ' + pts(i.price, 2) : pts(i.price, i.key === 'vix' ? 1 : 0);
      return `
        <div class="card stat">
          <div class="label">${i.label}</div>
          <div class="stat-value" style="font-size:22px;">${value}</div>
          <div class="delta">${chip(i.changePct)}</div>
        </div>`;
    }).join('');
  }

  function renderB3(list) {
    const tbody = document.getElementById('b3Table');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty">Indisponivel agora.</td></tr>'; return; }
    const sorted = [...list].sort((a, b) => b.changePct - a.changePct);
    tbody.innerHTML = sorted.map((s) => `
      <tr>
        <td><div class="asset">
          <span class="sym-badge">${s.ticker.slice(0, 4)}</span>
          <div><div class="nm">${s.name}</div><div class="sub">${s.ticker}</div></div>
        </div></td>
        <td class="num cell-value">R$ ${pts(s.price, 2)}</td>
        <td class="num">${chip(s.changePct)}</td>
      </tr>`).join('');
  }

  // ---------- Cambio & Juros ----------
  function renderFx(list) {
    document.getElementById('fxRow').innerHTML = list.map((f) => `
      <div class="card stat">
        <div class="label">${f.label}</div>
        <div class="stat-value" style="font-size:24px;">R$ ${pts(f.price, 3)}</div>
        <div class="delta">${chip(f.changePct)}</div>
      </div>`).join('');
  }

  function renderRates(m) {
    const body = document.getElementById('ratesBody');
    body.classList.remove('skeleton');
    const row = (label, value, note) => `
      <div style="padding:11px 0;border-bottom:1px solid var(--line-row);">
        <div class="flex justify-between">
          <span class="text-muted" style="font-size:12.5px;">${label}</span>
          <strong style="font-variant-numeric:tabular-nums;">${value}</strong>
        </div>
        ${note ? `<div class="text-muted" style="font-size:10.5px;margin-top:2px;">${note}</div>` : ''}
      </div>`;
    const realRate = (m.selic != null && m.ipca12m != null)
      ? (((1 + m.selic / 100) / (1 + m.ipca12m / 100)) - 1) * 100 : null;
    body.innerHTML =
      row('SELIC (meta)', m.selic != null ? `${Number(m.selic).toFixed(2)}% a.a.` : '—', 'taxa basica de juros') +
      row('IPCA acumulado 12m', m.ipca12m != null ? `${m.ipca12m.toFixed(2)}%` : '—', 'inflacao oficial') +
      row('Juro real aproximado', realRate != null ? `${realRate.toFixed(2)}% a.a.` : '—', 'SELIC descontada a inflacao');
  }

  // ---------- Graficos (lazy por aba) ----------
  const CHART_CFG = {
    idx: { tabs: 'idxTabs', ranges: 'idxRangeTabs', canvas: 'indexChart', title: 'idxTitle' },
    crypto: { tabs: 'cryptoIdxTabs', ranges: 'cryptoRangeTabs', canvas: 'cryptoChart', title: 'cryptoChartTitle' },
    fx: { tabs: 'fxTabs', ranges: 'fxRangeTabs', canvas: 'fxChart', title: 'fxTitle' },
  };

  async function loadChart(which) {
    const st = chartState[which];
    const cfg = CHART_CFG[which];
    st.loaded = true;
    try {
      const h = await window.API.indexHistory(st.key, st.range);
      document.getElementById(cfg.title).textContent = h.label;
      if (!h.points.length) { window.App.toast('Serie indisponivel agora.', 'error'); return; }
      const labels = h.points.map((p) => {
        const d = new Date(p.date + 'T00:00:00');
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      });
      window.Charts.line(cfg.canvas, labels, h.points.map((p) => p.value), {
        fmt: h.kind === 'usd' ? 'usd' : (h.kind === 'pts' ? 'pts' : 'brl'),
      });
    } catch {
      window.App.toast('Falha ao carregar o grafico.', 'error');
    }
  }

  for (const which of Object.keys(CHART_CFG)) {
    const cfg = CHART_CFG[which];
    document.getElementById(cfg.tabs).addEventListener('click', (e) => {
      const tab = e.target.closest('.range-tab');
      if (!tab || !tab.dataset.idx) return;
      document.querySelectorAll(`#${cfg.tabs} .range-tab`).forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      chartState[which].key = tab.dataset.idx;
      loadChart(which);
    });
    document.getElementById(cfg.ranges).addEventListener('click', (e) => {
      const tab = e.target.closest('.range-tab');
      if (!tab || !tab.dataset.range) return;
      document.querySelectorAll(`#${cfg.ranges} .range-tab`).forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      chartState[which].range = tab.dataset.range;
      loadChart(which);
    });
  }

  load();
  // Atualiza os numeros a cada 2 minutos (cache curto no backend).
  setInterval(load, 120000);
})();
