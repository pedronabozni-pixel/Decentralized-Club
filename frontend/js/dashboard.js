// ==========================================================================
//  Dashboard: KPIs, evolucao do patrimonio, distribuicao e comparativos.
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('dashboard.html');

  // Dashboard consolidado em BRL; a tabela de posicoes cripto exibe USD.
  const { fmtBRL, fmtUSD, fmtPct, signClass } = window.App;
  let currentDays = 30;

  // Estado do tempo real: posicoes cripto (USD) + parcelas estaticas (BRL).
  const live = { bySymbol: new Map(), usdRate: null, fixedValue: 0, totalInvested: 0 };

  async function loadSummary() {
    let data;
    try {
      data = await window.API.portfolio();
    } catch (err) {
      window.App.toast(err.message || 'Falha ao carregar dashboard.', 'error');
      return;
    }
    renderKpis(data);
    renderMarketMeta(data.market);
    renderAllocation(data.allocation);
    renderTopPositions(data.crypto.positions);
    renderCompare(data.crypto.value, data.fixedIncome.value, data.assets?.value || 0);
    startLive(data);
  }

  function renderKpis(d) {
    const dayCls = signClass(d.dayChange);
    const totCls = signClass(d.totalGainLoss);
    document.getElementById('kpis').innerHTML = `
      <div class="card stat">
        <span class="accent-line"></span>
        <div class="label">Patrimonio total</div>
        <div class="stat-value serif" id="kpiTotalValue">${fmtBRL(d.totalValue)}</div>
        <div class="delta text-muted">${d.crypto.positions.length} criptos · ${d.fixedIncome.count} renda fixa · ${d.assets?.count || 0} ativos</div>
      </div>
      <div class="card stat">
        <div class="label">Ganho/Perda do dia</div>
        <div class="stat-value ${dayCls}">${fmtBRL(d.dayChange)}</div>
        <div class="delta ${dayCls}">${fmtPct(d.dayChangePercent)}</div>
      </div>
      <div class="card stat">
        <div class="label">Ganho/Perda total</div>
        <div class="stat-value ${totCls}" id="kpiTotalGain">${fmtBRL(d.totalGainLoss)}</div>
        <div class="delta ${totCls}" id="kpiTotalGainPct">${fmtPct(d.totalGainLossPercent)}</div>
      </div>
      <div class="card stat">
        <div class="label">Total investido</div>
        <div class="stat-value">${fmtBRL(d.totalInvested)}</div>
        <div class="delta text-muted">Custo de aquisicao</div>
      </div>`;
  }

  function renderMarketMeta(market) {
    const usd = market.usdBrl;
    const dom = market.global.btcDominance;
    const usdCls = usd.pctChange >= 0 ? 'positive' : 'negative';
    document.getElementById('marketMeta').innerHTML = `
      USD/BRL <strong class="text-gold">R$ ${usd.rate?.toFixed(3) ?? '—'}</strong>
      <span class="${usdCls}">(${fmtPct(usd.pctChange)})</span>
      &nbsp;·&nbsp; Dominancia BTC <strong>${dom ? dom.toFixed(1) + '%' : '—'}</strong>`;
  }

  function renderAllocation(a) {
    // Novo formato: { total, groups: [{ key, label, value, percent }] }
    const palette = window.Charts.PALETTE;
    const items = (a.groups || []).map((g, i) => ({ ...g, color: palette[i % palette.length] }));

    if (!items.length) {
      document.getElementById('allocLegend').innerHTML =
        '<div class="empty" style="padding:20px;">Sem investimentos ainda.</div>';
      return;
    }

    window.Charts.doughnut('allocChart', items.map((i) => i.label),
      items.map((i) => i.value), items.map((i) => i.color));

    document.getElementById('allocLegend').innerHTML = items.map((i) => `
      <div class="alloc-row">
        <span class="alloc-dot" style="background:${i.color}"></span>
        <div class="alloc-label">
          ${i.label}<span class="pct">${i.percent.toFixed(1)}%</span>
          <div class="alloc-bar"><span style="width:${i.percent}%;background:${i.color}"></span></div>
        </div>
        <div class="text-right" style="font-size:.84rem;">${fmtBRL(i.value)}</div>
      </div>`).join('');
  }

  function renderTopPositions(positions) {
    const tbody = document.getElementById('topPositions');
    if (!positions.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty" style="padding:30px;">
        Nenhuma cripto ainda. <a class="text-gold" href="criptomoedas.html">Adicionar compra →</a></td></tr>`;
      return;
    }
    tbody.innerHTML = positions.slice(0, 5).map((p) => `
      <tr data-symbol="${p.symbol}">
        <td>
          <div class="asset">
            <span class="sym-badge">${window.App.symBadge(p.symbol)}</span>
            <div><div class="nm">${p.name}</div><div class="sub">${window.App.fmtNum(p.quantity)} ${p.symbol}</div></div>
          </div>
        </td>
        <td class="num">${fmtUSD(p.avgPrice)}</td>
        <td class="num cell-price">${fmtUSD(p.currentPrice)}</td>
        <td class="num cell-gl ${signClass(p.gainLoss)}">
          ${fmtUSD(p.gainLoss)}<br><span style="font-size:.78rem;">${fmtPct(p.gainLossPercent)}</span>
        </td>
      </tr>`).join('');
  }

  function renderCompare(cryptoValue, fixedValue, assetsValue) {
    window.Charts.bars('compareChart', ['Criptomoedas', 'Renda Fixa', 'Outros Ativos'],
      [cryptoValue, fixedValue, assetsValue],
      [window.Charts.PALETTE[0], window.Charts.PALETTE[3], window.Charts.PALETTE[1]]);
  }

  // ---------- Tempo real (WebSocket Binance) ----------
  async function startLive(d) {
    if (!window.Realtime || !d.crypto.positions.length) return;
    // Parcela estatica do patrimonio (renda fixa + outros ativos), em BRL.
    live.fixedValue = d.fixedIncome.value + (d.assets?.value || 0);
    live.totalInvested = d.totalInvested;        // BRL
    live.bySymbol = new Map(d.crypto.positions.map((p) => [p.symbol, {
      qty: p.quantity, avg: p.avgPrice, priceUsd: p.currentPrice,
    }]));

    // Dolar necessario apenas para consolidar os KPIs em BRL.
    if (!live.usdRate) live.usdRate = d.market.usdBrl?.rate;
    if (!live.usdRate) return;

    window.Realtime.connect([...live.bySymbol.keys()], (symbol, priceUsdt) => {
      const st = live.bySymbol.get(symbol);
      if (!st) return;
      st.priceUsd = priceUsdt; // USDT ~ USD, sem conversao na tabela
      updateLiveRow(symbol, st);
      updateLiveKpis();
    });
  }

  function updateLiveRow(symbol, st) {
    const row = document.querySelector(`#topPositions tr[data-symbol="${symbol}"]`);
    if (!row) return;
    row.querySelector('.cell-price').textContent = fmtUSD(st.priceUsd);
    const gl = (st.priceUsd - st.avg) * st.qty;
    const glPct = st.avg > 0 ? ((st.priceUsd - st.avg) / st.avg) * 100 : 0;
    const glCell = row.querySelector('.cell-gl');
    glCell.className = `num cell-gl ${signClass(gl)}`;
    glCell.innerHTML = `${fmtUSD(gl)}<br><span style="font-size:.78rem;">${fmtPct(glPct)}</span>`;
  }

  function updateLiveKpis() {
    let cryptoValueUsd = 0;
    for (const st of live.bySymbol.values()) cryptoValueUsd += st.qty * st.priceUsd;
    const totalValue = cryptoValueUsd * live.usdRate + live.fixedValue;
    const gain = totalValue - live.totalInvested;
    const gainPct = live.totalInvested > 0 ? (gain / live.totalInvested) * 100 : 0;

    const tv = document.getElementById('kpiTotalValue');
    if (tv) tv.textContent = fmtBRL(totalValue);
    const g = document.getElementById('kpiTotalGain');
    const gp = document.getElementById('kpiTotalGainPct');
    if (g) { g.textContent = fmtBRL(gain); g.className = `stat-value ${signClass(gain)}`; }
    if (gp) { gp.textContent = fmtPct(gainPct); gp.className = `delta ${signClass(gain)}`; }
  }

  async function loadEvolution() {
    try {
      const { points } = await window.API.portfolioEvolution(currentDays);
      if (!points.length) {
        // Sem historico de cripto disponivel ainda.
        window.Charts.line('evolutionChart', ['—'], [0]);
        return;
      }
      const labels = points.map((p) => {
        const d = new Date(p.date + 'T00:00:00');
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      });
      window.Charts.line('evolutionChart', labels, points.map((p) => p.total));
    } catch (err) {
      window.App.toast('Evolucao indisponivel no momento.', 'error');
    }
  }

  // Range tabs (7/30/90 dias)
  document.getElementById('rangeTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.range-tab');
    if (!tab) return;
    document.querySelectorAll('#rangeTabs .range-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentDays = Number(tab.dataset.days);
    loadEvolution();
  });

  loadSummary();
  loadEvolution();
})();
