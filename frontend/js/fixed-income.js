// ==========================================================================
//  Pagina Renda Fixa: CRUD + dashboard (investido, rendimento acumulado e
//  projetado). Sugestao de taxa via SELIC (BCB).
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('renda-fixa.html');

  const { fmtBRL, fmtDate, signClass } = window.App;

  async function load() {
    let data;
    try {
      data = await window.API.fixedIncome();
    } catch (err) {
      window.App.toast(err.message || 'Falha ao carregar renda fixa.', 'error');
      return;
    }
    renderKpis(data.summary);
    renderTable(data.items);
  }

  function renderKpis(s) {
    document.getElementById('fixedKpis').innerHTML = `
      <div class="card stat"><span class="accent-line"></span>
        <div class="label">Total investido</div>
        <div class="stat-value serif">${fmtBRL(s.totalInvested)}</div></div>
      <div class="card stat"><div class="label">Valor atual</div>
        <div class="stat-value">${fmtBRL(s.currentValue)}</div></div>
      <div class="card stat"><div class="label">Rendimento acumulado</div>
        <div class="stat-value positive">${fmtBRL(s.accruedYield)}</div></div>
      <div class="card stat"><div class="label">Projetado (venc.)</div>
        <div class="stat-value text-gold">${fmtBRL(s.projectedYield)}</div></div>`;
  }

  function renderTable(items) {
    const tbody = document.getElementById('fixedBody');
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty">
        <div class="ico">▦</div>Nenhum investimento. Clique em <strong>+ Cadastrar investimento</strong>.</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map((it) => `
      <tr>
        <td><div class="nm">${it.type}</div><div class="sub text-muted" style="font-size:.78rem;">${it.description || ''}</div></td>
        <td>${it.bank || '—'}</td>
        <td class="num">${fmtBRL(it.amount)}</td>
        <td class="num">${Number(it.rate).toFixed(2)}%</td>
        <td>${fmtDate(it.date_invested)}</td>
        <td>${it.maturity_date ? fmtDate(it.maturity_date) : '—'}</td>
        <td class="num positive">${fmtBRL(it.accruedYield)}</td>
        <td class="num">${fmtBRL(it.currentValue)}</td>
        <td class="num"><button class="btn-icon-danger del-fi" data-id="${it.id}" title="Excluir">✕</button></td>
      </tr>`).join('');

    tbody.querySelectorAll('.del-fi').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir este investimento?')) return;
        try {
          await window.API.deleteFixedIncome(btn.dataset.id);
          window.App.toast('Investimento excluido.', 'success');
          load();
        } catch (err) { window.App.toast(err.message, 'error'); }
      });
    });
  }

  // ---------- SELIC (sugestao de taxa) ----------
  (async () => {
    try {
      const s = await window.API.selic();
      if (s.selic) {
        document.getElementById('selicHint').textContent =
          `SELIC atual: ${Number(s.selic).toFixed(2)}% a.a. (${s.date || ''})`;
      }
    } catch { /* silencioso */ }
  })();

  // ---------- Modal cadastrar ----------
  document.getElementById('openAddBtn').addEventListener('click', () => {
    document.getElementById('addFixedForm').reset();
    document.getElementById('fiDate').value = new Date().toISOString().slice(0, 10);
    window.App.openModal('addModal');
  });

  document.getElementById('addFixedForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Aceita formato brasileiro (10.000,00) e americano (10,000.00).
    const amount = window.App.parseDecimal(document.getElementById('fiAmount').value, { money: true });
    const rate = window.App.parseDecimal(document.getElementById('fiRate').value);
    if (!(amount > 0)) { window.App.toast('Valor investido invalido.', 'error'); return; }
    if (!(rate >= 0)) { window.App.toast('Taxa invalida.', 'error'); return; }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      await window.API.addFixedIncome({
        type: document.getElementById('fiType').value,
        bank: document.getElementById('fiBank').value.trim() || undefined,
        description: document.getElementById('fiDesc').value.trim() || undefined,
        amount,
        rate,
        dateInvested: document.getElementById('fiDate').value,
        maturityDate: document.getElementById('fiMaturity').value || undefined,
      });
      window.App.toast('Investimento cadastrado!', 'success');
      window.App.closeModal('addModal');
      load();
    } catch (err) {
      const detail = err.details?.[0]?.message;
      window.App.toast(detail || err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar';
    }
  });

  load();
})();
