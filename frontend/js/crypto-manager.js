// ==========================================================================
//  Pagina Criptomoedas: posicoes, adicionar compra (autocomplete CoinGecko),
//  preco medio, ganho/perda, historico e grafico de performance por moeda.
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('criptomoedas.html');

  // Secao de criptomoedas opera em USD (moeda nativa do mercado cripto).
  const { fmtUSD, fmtPct, fmtNum, fmtDate, signClass } = window.App;
  let selectedSymbol = null;

  // Estado do tempo real (WebSocket Binance, precos ja em USDT ~ USD).
  const live = { bySymbol: new Map(), totalSpent: 0 };

  // ---------- Carregar posicoes ----------
  async function loadPositions() {
    let data;
    try {
      data = await window.API.cryptoPositions();
    } catch (err) {
      window.App.toast(err.message || 'Falha ao carregar posicoes.', 'error');
      return;
    }
    renderKpis(data.summary);
    renderPositions(data.positions);
    startLive(data.positions, data.summary);

    // Seleciona a primeira moeda por padrao p/ historico + grafico.
    if (data.positions.length && !selectedSymbol) {
      selectCoin(data.positions[0].symbol, data.positions[0].name, data.positions[0].avgPrice);
    }
  }

  function renderKpis(s) {
    const cls = signClass(s.totalGainLoss);
    document.getElementById('cryptoKpis').innerHTML = `
      <div class="card stat"><span class="accent-line"></span>
        <div class="label">Valor de mercado</div>
        <div class="stat-value serif" id="kpiMarketValue">${fmtUSD(s.totalValue)}</div></div>
      <div class="card stat"><div class="label">Investido</div>
        <div class="stat-value">${fmtUSD(s.totalSpent)}</div></div>
      <div class="card stat"><div class="label">Ganho/Perda total</div>
        <div class="stat-value ${cls}" id="kpiGain">${fmtUSD(s.totalGainLoss)}</div>
        <div class="delta ${cls}" id="kpiGainPct">${fmtPct(s.totalGainLossPercent)}</div></div>`;
  }

  function renderPositions(positions) {
    const tbody = document.getElementById('positionsBody');
    if (!positions.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">
        <div class="ico">₿</div>Nenhuma posicao ainda. Clique em <strong>+ Adicionar compra</strong>.</td></tr>`;
      return;
    }
    tbody.innerHTML = positions.map((p) => `
      <tr class="pos-row" data-symbol="${p.symbol}" data-name="${p.name}" data-avg="${p.avgPrice}" data-qty="${p.quantity}" style="cursor:pointer;">
        <td><div class="asset"><span class="sym-badge">${window.App.symBadge(p.symbol)}</span>
          <div><div class="nm">${p.name}</div><div class="sub">${p.symbol}</div></div></div></td>
        <td class="num">${fmtNum(p.quantity)}</td>
        <td class="num">${fmtUSD(p.avgPrice)}</td>
        <td class="num cell-price">${fmtUSD(p.currentPrice)}</td>
        <td class="num cell-24h ${signClass(p.change24h)}">${fmtPct(p.change24h)}</td>
        <td class="num cell-value">${fmtUSD(p.currentValue)}</td>
        <td class="num cell-gl ${signClass(p.gainLoss)}">${fmtUSD(p.gainLoss)}<br>
          <span style="font-size:.78rem;">${fmtPct(p.gainLossPercent)}</span></td>
        <td class="num"><button class="btn btn-sm btn-ghost view-btn">ver</button></td>
      </tr>`).join('');

    tbody.querySelectorAll('.pos-row').forEach((row) => {
      row.addEventListener('click', () => {
        selectCoin(row.dataset.symbol, row.dataset.name, Number(row.dataset.avg));
      });
    });
  }

  // ---------- Tempo real (WebSocket Binance) ----------
  function startLive(positions, summary) {
    if (!window.Realtime || !positions.length) return;
    live.totalSpent = summary.totalSpent;
    live.bySymbol = new Map(positions.map((p) => [p.symbol, {
      qty: p.quantity, avg: p.avgPrice, priceUsd: p.currentPrice,
    }]));

    window.Realtime.connect([...live.bySymbol.keys()], onTick, setLiveStatus);
  }

  function onTick(symbol, priceUsdt, change24h) {
    const st = live.bySymbol.get(symbol);
    if (!st) return;
    // USDT ~ USD: o tick da Binance ja esta na moeda exibida, sem conversao.
    const direction = priceUsdt > st.priceUsd ? 'up' : (priceUsdt < st.priceUsd ? 'down' : null);
    st.priceUsd = priceUsdt;
    updateLiveRow(symbol, st, change24h, direction);
    updateLiveKpis();
  }

  function updateLiveRow(symbol, st, change24h, direction) {
    const row = document.querySelector(`.pos-row[data-symbol="${symbol}"]`);
    if (!row) return;
    const value = st.qty * st.priceUsd;
    const gl = (st.priceUsd - st.avg) * st.qty;
    const glPct = st.avg > 0 ? ((st.priceUsd - st.avg) / st.avg) * 100 : 0;

    const priceCell = row.querySelector('.cell-price');
    priceCell.textContent = fmtUSD(st.priceUsd);
    const cell24 = row.querySelector('.cell-24h');
    cell24.textContent = fmtPct(change24h);
    cell24.className = `num cell-24h ${signClass(change24h)}`;
    row.querySelector('.cell-value').textContent = fmtUSD(value);
    const glCell = row.querySelector('.cell-gl');
    glCell.className = `num cell-gl ${signClass(gl)}`;
    glCell.innerHTML = `${fmtUSD(gl)}<br><span style="font-size:.78rem;">${fmtPct(glPct)}</span>`;

    if (direction) {
      priceCell.classList.remove('flash-up', 'flash-down');
      void priceCell.offsetWidth; // reinicia a animacao
      priceCell.classList.add(direction === 'up' ? 'flash-up' : 'flash-down');
    }
  }

  function updateLiveKpis() {
    let totalValue = 0;
    for (const st of live.bySymbol.values()) totalValue += st.qty * st.priceUsd;
    const gain = totalValue - live.totalSpent;
    const gainPct = live.totalSpent > 0 ? (gain / live.totalSpent) * 100 : 0;

    const mv = document.getElementById('kpiMarketValue');
    if (mv) mv.textContent = fmtUSD(totalValue);
    const g = document.getElementById('kpiGain');
    const gp = document.getElementById('kpiGainPct');
    if (g) { g.textContent = fmtUSD(gain); g.className = `stat-value ${signClass(gain)}`; }
    if (gp) { gp.textContent = fmtPct(gainPct); gp.className = `delta ${signClass(gain)}`; }
  }

  function setLiveStatus(connected) {
    const badge = document.getElementById('liveBadge');
    if (!badge) return;
    badge.classList.toggle('on', connected);
    badge.innerHTML = `<span class="dot"></span>${connected ? 'ao vivo · binance' : 'reconectando…'}`;
  }

  // ---------- Historico + performance da moeda ----------
  async function selectCoin(symbol, name, avgPrice) {
    selectedSymbol = symbol;
    document.getElementById('histTitle').textContent = `Historico · ${name}`;
    document.getElementById('perfTitle').textContent = `Performance · ${name}`;
    document.getElementById('perfHint').textContent = `Preco medio: ${fmtUSD(avgPrice)}`;

    // Historico de compras
    try {
      const { buys } = await window.API.cryptoBuysBySymbol(symbol);
      renderHistory(buys);
    } catch { /* silencioso */ }

    // Grafico de performance (preco 30d + linha de preco medio)
    try {
      const { points } = await window.API.priceHistory(symbol, 30);
      if (points.length >= 2) {
        const labels = points.map((p) => new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
        window.Charts.lineWithAverage('perfChart', labels, points.map((p) => p.price), avgPrice);
      } else {
        // Ainda sem serie suficiente: mostra ponto atual vs preco medio.
        window.Charts.lineWithAverage('perfChart', ['hoje'], [avgPrice], avgPrice);
        document.getElementById('perfHint').textContent =
          'Historico sendo construido — recarregue ao longo dos dias.';
      }
    } catch { /* silencioso */ }
  }

  function renderHistory(buys) {
    const tbody = document.getElementById('historyBody');
    if (!buys.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">Sem compras registradas.</td></tr>`;
      return;
    }
    tbody.innerHTML = buys.map((b) => `
      <tr>
        <td>${fmtDate(b.date_bought)}</td>
        <td class="num">${fmtNum(b.quantity)}</td>
        <td class="num">${fmtUSD(b.price_per_unit)}</td>
        <td class="num">${fmtUSD(b.total_spent)}</td>
        <td class="num"><button class="btn-icon-danger del-buy" data-id="${b.id}" title="Excluir">✕</button></td>
      </tr>`).join('');

    tbody.querySelectorAll('.del-buy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir esta compra?')) return;
        try {
          await window.API.deleteCryptoBuy(btn.dataset.id);
          window.App.toast('Compra excluida.', 'success');
          await loadPositions();
          if (selectedSymbol) {
            const { buys } = await window.API.cryptoBuysBySymbol(selectedSymbol);
            renderHistory(buys);
          }
        } catch (err) { window.App.toast(err.message, 'error'); }
      });
    });
  }

  // ---------- Modal: adicionar compra + autocomplete ----------
  const modal = 'addModal';
  const searchInput = document.getElementById('coinSearch');
  const resultsBox = document.getElementById('coinResults');
  const qtyInput = document.getElementById('buyQty');
  const priceInput = document.getElementById('buyPrice');

  document.getElementById('openAddBtn').addEventListener('click', () => {
    document.getElementById('addBuyForm').reset();
    document.getElementById('coinSymbol').value = '';
    document.getElementById('coinName').value = '';
    document.getElementById('buyDate').value = new Date().toISOString().slice(0, 10);
    updateTotal();
    window.App.openModal(modal);
    setTimeout(() => searchInput.focus(), 100);
  });

  let searchTimer;
  searchInput.addEventListener('input', () => {
    document.getElementById('coinSymbol').value = '';
    const q = searchInput.value.trim();
    clearTimeout(searchTimer);
    if (q.length < 1) { resultsBox.classList.remove('open'); return; }
    searchTimer = setTimeout(async () => {
      try {
        const { results } = await window.API.searchCoins(q);
        renderSearchResults(results);
      } catch { /* silencioso */ }
    }, 220);
  });

  function renderSearchResults(results) {
    if (!results.length) { resultsBox.classList.remove('open'); return; }
    resultsBox.innerHTML = results.map((r) => `
      <div class="autocomplete-item" data-symbol="${r.symbol}" data-name="${r.name}">
        <span>${r.name}</span><span class="sym">${r.symbol}</span>
      </div>`).join('');
    resultsBox.classList.add('open');
    resultsBox.querySelectorAll('.autocomplete-item').forEach((item) => {
      item.addEventListener('click', () => {
        document.getElementById('coinSymbol').value = item.dataset.symbol;
        document.getElementById('coinName').value = item.dataset.name;
        searchInput.value = `${item.dataset.name} (${item.dataset.symbol})`;
        resultsBox.classList.remove('open');
        document.getElementById('coinHint').textContent = `Selecionado: ${item.dataset.symbol}`;
      });
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete')) resultsBox.classList.remove('open');
  });

  // Interpreta os campos aceitando formato brasileiro (75.687,76) e americano.
  const parseQty = () => window.App.parseDecimal(qtyInput.value);
  const parsePrice = () => window.App.parseDecimal(priceInput.value, { money: true });

  [qtyInput, priceInput].forEach((i) => i.addEventListener('input', updateTotal));
  function updateTotal() {
    const qty = parseQty();
    const price = parsePrice();
    const total = (qty > 0 && price >= 0) ? qty * price : 0;
    document.getElementById('buyTotal').textContent = fmtUSD(total);
    // Mostra como o preco digitado foi interpretado, para pegar erro na hora.
    const preview = document.getElementById('pricePreview');
    if (preview) {
      preview.textContent = price >= 0 && priceInput.value.trim()
        ? `Interpretado como ${fmtUSD(price)} por unidade`
        : '';
    }
  }

  document.getElementById('addBuyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    let symbol = document.getElementById('coinSymbol').value;
    const name = document.getElementById('coinName').value;
    // Permite digitar simbolo manualmente se nao selecionou da lista.
    if (!symbol) symbol = searchInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (!symbol) { window.App.toast('Selecione uma moeda.', 'error'); return; }

    const quantity = parseQty();
    const pricePerUnit = parsePrice();
    if (!(quantity > 0)) { window.App.toast('Quantidade invalida.', 'error'); return; }
    if (!(pricePerUnit >= 0)) { window.App.toast('Preco invalido.', 'error'); return; }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Salvando...';

    // Trava de sanidade: se o preco digitado divergir demais do mercado
    // (3x para cima ou para baixo), pede confirmacao antes de gravar.
    try {
      const { prices } = await window.API.get(`/market/prices?symbols=${encodeURIComponent(symbol)}`);
      const marketUsd = prices?.[symbol]?.usd;
      if (marketUsd > 0 && pricePerUnit > 0) {
        const ratio = pricePerUnit / marketUsd;
        if (ratio > 3 || ratio < 1 / 3) {
          const ok = confirm(
            `Atencao: voce informou ${fmtUSD(pricePerUnit)} por unidade de ${symbol}, ` +
            `mas o preco atual de mercado e ${fmtUSD(marketUsd)}.\n\n` +
            `Confirma que pagou ${fmtUSD(pricePerUnit)} por unidade?`
          );
          if (!ok) {
            btn.disabled = false; btn.textContent = 'Salvar compra';
            return;
          }
        }
      }
    } catch { /* mercado indisponivel: segue sem a checagem */ }

    try {
      await window.API.addCryptoBuy({
        symbol, name: name || symbol,
        quantity,
        pricePerUnit,
        dateBought: document.getElementById('buyDate').value,
      });
      window.App.toast('Compra registrada!', 'success');
      window.App.closeModal(modal);
      selectedSymbol = symbol;
      await loadPositions();
    } catch (err) {
      const detail = err.details?.[0]?.message;
      window.App.toast(detail || err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar compra';
    }
  });

  loadPositions();
})();
