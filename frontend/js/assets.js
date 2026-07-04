// ==========================================================================
//  Pagina Ativos: todas as classes de investimento do Brasil.
//  Bolsa/moedas/ouro com cotacao automatica; fundos e fisicos com valor manual.
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('ativos.html');

  const { fmtBRL, fmtPct, fmtNum, fmtDate, signClass, parseDecimal } = window.App;

  let categories = {}; // catalogo vindo do backend

  // ---------- Carregar catalogo + lista ----------
  async function init() {
    try {
      const cat = await window.API.assetCategories();
      categories = cat.categories;
      buildCategorySelect();
    } catch { /* select fica vazio; erro aparece no load() */ }
    await load();
  }

  async function load() {
    let data;
    try {
      data = await window.API.assets();
    } catch (err) {
      window.App.toast(err.message || 'Falha ao carregar ativos.', 'error');
      return;
    }
    renderKpis(data.summary);
    renderGroups(data.items);
  }

  function renderKpis(s) {
    const cls = signClass(s.gainLoss);
    document.getElementById('assetKpis').innerHTML = `
      <div class="card stat"><span class="accent-line"></span>
        <div class="label">Valor atual</div>
        <div class="stat-value serif">${fmtBRL(s.currentValue)}</div></div>
      <div class="card stat"><div class="label">Investido</div>
        <div class="stat-value">${fmtBRL(s.totalInvested)}</div></div>
      <div class="card stat"><div class="label">Ganho/Perda</div>
        <div class="stat-value ${cls}">${fmtBRL(s.gainLoss)}</div>
        <div class="delta ${cls}">${fmtPct(s.gainLossPercent)}</div></div>`;
  }

  // ---------- Lista agrupada por classe ----------
  function renderGroups(items) {
    const wrap = document.getElementById('assetGroups');
    if (!items.length) {
      wrap.innerHTML = `<div class="card"><div class="empty"><div class="ico">◆</div>
        Nenhum ativo ainda. Cadastre acoes, FIIs, imoveis, fundos e mais em
        <strong>+ Cadastrar ativo</strong>.</div></div>`;
      return;
    }

    // Agrupa por categoryGroup preservando ordem do catalogo.
    const byGroup = new Map();
    for (const a of items) {
      if (!byGroup.has(a.categoryGroup)) byGroup.set(a.categoryGroup, []);
      byGroup.get(a.categoryGroup).push(a);
    }

    wrap.innerHTML = [...byGroup.entries()].map(([group, list]) => {
      const groupValue = list.reduce((s, a) => s + a.currentValueBrl, 0);
      return `
      <div class="section-title"><h2>${group}</h2>
        <span class="hint">${fmtBRL(groupValue)}</span></div>
      <div class="card" style="margin-bottom:8px;">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Ativo</th><th class="num">Qtd</th>
              <th class="num">Investido</th><th class="num">Valor atual</th>
              <th class="num">Ganho/Perda</th><th>Fonte</th><th></th>
            </tr></thead>
            <tbody>
              ${list.map(rowHtml).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }).join('');

    // Acoes das linhas
    wrap.querySelectorAll('.del-asset').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir este ativo?')) return;
        try {
          await window.API.deleteAsset(btn.dataset.id);
          window.App.toast('Ativo excluido.', 'success');
          load();
        } catch (err) { window.App.toast(err.message, 'error'); }
      });
    });
    wrap.querySelectorAll('.edit-value').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('valAssetId').value = btn.dataset.id;
        document.getElementById('valAssetName').textContent = btn.dataset.name;
        document.getElementById('valCurrent').value = '';
        window.App.openModal('valueModal');
        setTimeout(() => document.getElementById('valCurrent').focus(), 100);
      });
    });
  }

  function rowHtml(a) {
    const auto = a.source !== 'manual';
    const fonte = auto
      ? `<span class="pill up" title="${a.source}">auto</span>`
      : `<button class="btn btn-sm btn-ghost edit-value" data-id="${a.id}" data-name="${a.name}">atualizar</button>`;
    return `
      <tr>
        <td><div class="asset">
          <span class="sym-badge">${(a.ticker || a.name).slice(0, 4).toUpperCase()}</span>
          <div><div class="nm">${a.name}</div>
          <div class="sub">${a.categoryLabel}${a.purchase_date ? ' · ' + fmtDate(a.purchase_date) : ''}</div></div>
        </div></td>
        <td class="num">${a.quantity != null ? fmtNum(a.quantity) : '—'}</td>
        <td class="num">${fmtBRL(a.invested)}</td>
        <td class="num">${fmtBRL(a.currentValueBrl)}${a.priceBrl ? `<br><span class="text-muted" style="font-size:.74rem;">${fmtBRL(a.priceBrl)}/un</span>` : ''}</td>
        <td class="num ${signClass(a.gainLoss)}">${fmtBRL(a.gainLoss)}<br>
          <span style="font-size:.78rem;">${fmtPct(a.gainLossPercent)}</span></td>
        <td>${fonte}</td>
        <td class="num"><button class="btn-icon-danger del-asset" data-id="${a.id}" title="Excluir">✕</button></td>
      </tr>`;
  }

  // ---------- Select de categorias (agrupado) ----------
  function buildCategorySelect() {
    const select = document.getElementById('astCategory');
    const groups = new Map();
    for (const [key, c] of Object.entries(categories)) {
      if (!groups.has(c.group)) groups.set(c.group, []);
      groups.get(c.group).push({ key, ...c });
    }
    select.innerHTML = [...groups.entries()].map(([group, list]) => `
      <optgroup label="${group}">
        ${list.map((c) => `<option value="${c.key}">${c.label}</option>`).join('')}
      </optgroup>`).join('');
    select.addEventListener('change', onCategoryChange);
    onCategoryChange();
  }

  function onCategoryChange() {
    const key = document.getElementById('astCategory').value;
    const info = categories[key] || {};
    const auto = info.quote && info.quote !== 'manual';
    document.getElementById('tickerRow').style.display = auto ? '' : 'none';
    document.getElementById('categoryHint').textContent = auto
      ? 'Cotacao automatica: informe ticker e quantidade.'
      : 'Sem cotacao automatica: informe o valor atual e atualize quando quiser.';
    const tickerHint = {
      b3: 'Codigo da B3, ex: PETR4, MXRF11, BOVA11',
      us: 'Ticker internacional, ex: AAPL, VOO, O',
      fx: 'Codigo da moeda, ex: USD, EUR, GBP',
      gold: 'Deixe XAU (onca troy de ouro)',
    }[info.quote] || '';
    document.getElementById('tickerHint').textContent = tickerHint;
    if (info.quote === 'gold') document.getElementById('astTicker').value = 'XAU';
  }

  // ---------- Cadastrar ----------
  document.getElementById('openAddBtn').addEventListener('click', () => {
    document.getElementById('addAssetForm').reset();
    document.getElementById('astDate').value = new Date().toISOString().slice(0, 10);
    onCategoryChange();
    window.App.openModal('addModal');
  });

  document.getElementById('addAssetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const invested = parseDecimal(document.getElementById('astInvested').value, { money: true });
    if (!(invested >= 0)) { window.App.toast('Valor investido invalido.', 'error'); return; }

    const qtyRaw = document.getElementById('astQty').value.trim();
    const quantity = qtyRaw ? parseDecimal(qtyRaw) : null;
    if (qtyRaw && !(quantity > 0)) { window.App.toast('Quantidade invalida.', 'error'); return; }

    const cvRaw = document.getElementById('astCurrentValue').value.trim();
    const currentValue = cvRaw ? parseDecimal(cvRaw, { money: true }) : null;
    if (cvRaw && !(currentValue >= 0)) { window.App.toast('Valor atual invalido.', 'error'); return; }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      await window.API.addAsset({
        category: document.getElementById('astCategory').value,
        name: document.getElementById('astName').value.trim(),
        ticker: document.getElementById('astTicker').value.trim() || undefined,
        quantity: quantity ?? undefined,
        invested,
        currentValue: currentValue ?? undefined,
        purchaseDate: document.getElementById('astDate').value || undefined,
        notes: document.getElementById('astNotes').value.trim() || undefined,
      });
      window.App.toast('Ativo cadastrado!', 'success');
      window.App.closeModal('addModal');
      load();
    } catch (err) {
      const detail = err.details?.[0]?.message;
      window.App.toast(detail || err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar ativo';
    }
  });

  // ---------- Atualizar valor manual ----------
  document.getElementById('valueForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = parseDecimal(document.getElementById('valCurrent').value, { money: true });
    if (!(value >= 0)) { window.App.toast('Valor invalido.', 'error'); return; }
    try {
      await window.API.updateAssetValue(document.getElementById('valAssetId').value, value);
      window.App.toast('Valor atualizado!', 'success');
      window.App.closeModal('valueModal');
      load();
    } catch (err) { window.App.toast(err.message, 'error'); }
  });

  init();
})();
