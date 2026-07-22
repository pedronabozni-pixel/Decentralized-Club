// ==========================================================================
//  Pagina Mercados: indices e commodities (Yahoo), top criptos e trending
//  (CoinGecko), Fear & Greed (alternative.me) e macro Brasil (BCB).
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('mercados.html');

  const { fmtBRL, fmtPct, signClass } = window.App;
  const pts = (v, dec = 0) => new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(v || 0);

  let currentIdx = 'ibov';
  let currentRange = '6m';

  // ---------- Sparkline SVG (sem instancias de Chart.js) ----------
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

  // ---------- Overview ----------
  async function load() {
    let d;
    try {
      d = await window.API.marketOverview();
    } catch (err) {
      window.App.toast(err.message || 'Falha ao carregar mercados.', 'error');
      return;
    }
    renderTicker(d.macro);
    renderIndices(d.indices);
    renderFearGreed(d.fearGreed);
    renderMacro(d.macro);
    renderCryptos(d.cryptos, d.cryptoGlobal);
    renderB3(d.b3);
    renderTrending(d.trending);
  }

  function renderTicker(m) {
    document.getElementById('macroTicker').innerHTML = `
      USD/BRL <strong class="text-gold">R$ ${m.usdBrl?.toFixed(3) ?? '—'}</strong>
      <span class="${m.usdChangePct >= 0 ? 'positive' : 'negative'}">(${fmtPct(m.usdChangePct)})</span><br>
      EUR/BRL <strong>R$ ${m.eurBrl?.toFixed(3) ?? '—'}</strong>`;
  }

  function renderIndices(indices) {
    const byKey = Object.fromEntries(indices.map((i) => [i.key, i]));
    const order = ['ibov', 'sp500', 'nasdaq', 'ouro', 'petroleo'];
    document.getElementById('indicesRow').innerHTML = order.map((k) => {
      const i = byKey[k];
      if (!i) return `<div class="card stat"><div class="label">—</div><div class="stat-value">—</div></div>`;
      const cls = signClass(i.changePct);
      const chip = i.changePct >= 0 ? 'up' : 'down';
      const value = i.kind === 'usd' ? 'US$ ' + pts(i.price, 2) : pts(i.price);
      return `
        <div class="card stat">
          <div class="label">${i.label}</div>
          <div class="stat-value" style="font-size:22px;">${value}</div>
          <div class="delta"><span class="pill ${chip}">${fmtPct(i.changePct)}</span></div>
        </div>`;
    }).join('');
  }

  // ---------- Fear & Greed ----------
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

  // ---------- Macro Brasil ----------
  function renderMacro(m) {
    const body = document.getElementById('macroBody');
    body.classList.remove('skeleton');
    const row = (label, value) => `
      <div class="flex justify-between" style="padding:9px 0;border-bottom:1px solid var(--line-row);">
        <span class="text-muted" style="font-size:12.5px;">${label}</span>
        <strong style="font-variant-numeric:tabular-nums;">${value}</strong>
      </div>`;
    body.innerHTML =
      row('SELIC', m.selic != null ? `${Number(m.selic).toFixed(2)}% a.a.` : '—') +
      row('IPCA acumulado 12m', m.ipca12m != null ? `${m.ipca12m.toFixed(2)}%` : '—') +
      row('Dolar', `R$ ${m.usdBrl?.toFixed(3) ?? '—'}`) +
      row('Euro', `R$ ${m.eurBrl?.toFixed(3) ?? '—'}`);
  }

  // ---------- Top criptos ----------
  function renderCryptos(list, global) {
    if (global?.btcDominance) {
      document.getElementById('globalHint').textContent =
        `Dominancia BTC ${global.btcDominance.toFixed(1)}% · mercado ${fmtPct(global.marketCapChange24h)} em 24h`;
    }
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

  // ---------- B3 em destaque ----------
  function renderB3(list) {
    const tbody = document.getElementById('b3Table');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="3" class="empty">Indisponivel agora.</td></tr>'; return; }
    tbody.innerHTML = list.map((s) => `
      <tr>
        <td><div class="asset">
          <span class="sym-badge">${s.ticker.slice(0, 4)}</span>
          <div><div class="nm">${s.name}</div><div class="sub">${s.ticker}</div></div>
        </div></td>
        <td class="num cell-value">R$ ${pts(s.price, 2)}</td>
        <td class="num"><span class="pill ${s.changePct >= 0 ? 'up' : 'down'}">${fmtPct(s.changePct)}</span></td>
      </tr>`).join('');
  }

  // ---------- Trending ----------
  function renderTrending(list) {
    const el = document.getElementById('trendingList');
    if (!list.length) { el.innerHTML = '<div class="empty" style="padding:16px;">Indisponivel agora.</div>'; return; }
    el.innerHTML = list.map((t) => `
      <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid var(--line-row);">
        <div class="asset">
          <span class="sym-badge" style="width:30px;height:30px;">${t.symbol.slice(0, 4)}</span>
          <div><div class="nm" style="font-size:12.5px;">${t.name}</div></div>
        </div>
        <span class="text-muted" style="font-size:11px;">${t.rank ? '#' + t.rank + ' mkt cap' : ''}</span>
      </div>`).join('');
  }

  // ---------- Grafico do indice ----------
  async function loadIndexChart() {
    try {
      const h = await window.API.indexHistory(currentIdx, currentRange);
      document.getElementById('idxTitle').textContent = h.label;
      if (!h.points.length) {
        window.App.toast('Serie indisponivel agora.', 'error');
        return;
      }
      const labels = h.points.map((p) => {
        const d = new Date(p.date + 'T00:00:00');
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      });
      window.Charts.line('indexChart', labels, h.points.map((p) => p.value), {
        fmt: h.kind === 'usd' ? 'usd' : 'pts',
      });
    } catch (err) {
      window.App.toast('Falha ao carregar o grafico.', 'error');
    }
  }

  document.getElementById('idxTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.range-tab');
    if (!tab) return;
    document.querySelectorAll('#idxTabs .range-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentIdx = tab.dataset.idx;
    loadIndexChart();
  });
  document.getElementById('rangeTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.range-tab');
    if (!tab) return;
    document.querySelectorAll('#rangeTabs .range-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentRange = tab.dataset.range;
    loadIndexChart();
  });

  load();
  loadIndexChart();
  // Atualiza os numeros a cada 2 minutos (cache curto no backend).
  setInterval(load, 120000);
})();
