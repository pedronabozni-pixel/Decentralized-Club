// ==========================================================================
//  Pagina Renda Fixa: CRUD + dashboard (investido, rendimento acumulado e
//  projetado). Sugestao de taxa via SELIC (BCB).
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('renda-fixa.html');

  const { fmtBRL, fmtDate, signClass } = window.App;

  let itemsById = new Map(); // investimentos carregados (para edicao)
  let editingId = null;      // null = cadastro; id = edicao

  async function load() {
    let data;
    try {
      data = await window.API.fixedIncome();
    } catch (err) {
      window.App.toast(err.message || 'Falha ao carregar renda fixa.', 'error');
      return;
    }
    itemsById = new Map(data.items.map((it) => [String(it.id), it]));
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
        <td class="num" style="white-space:nowrap;">
          <button class="btn btn-sm btn-ghost edit-fi" data-id="${it.id}" title="Editar">editar</button>
          <button class="btn-icon-danger del-fi" data-id="${it.id}" title="Excluir">✕</button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('.edit-fi').forEach((btn) => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
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

  // ---------- Modal cadastrar / editar ----------
  const toField = (v) => (v == null ? '' : String(v).replace('.', ','));

  function setModalMode(mode, label) {
    const title = document.querySelector('#addModal .modal-head h3');
    const submit = document.querySelector('#addFixedForm button[type=submit]');
    if (mode === 'edit') {
      title.textContent = `Editar · ${label}`;
      submit.textContent = 'Salvar alteracoes';
    } else {
      title.textContent = 'Cadastrar investimento';
      submit.textContent = 'Salvar';
    }
  }

  function openEditModal(id) {
    const it = itemsById.get(String(id));
    if (!it) return;
    editingId = it.id;
    document.getElementById('fiType').value = it.type;
    document.getElementById('fiBank').value = it.bank || '';
    document.getElementById('fiDesc').value = it.description || '';
    document.getElementById('fiAmount').value = toField(it.amount);
    document.getElementById('fiRate').value = toField(it.rate);
    document.getElementById('fiDate').value = it.date_invested;
    document.getElementById('fiMaturity').value = it.maturity_date || '';
    setModalMode('edit', it.description || it.type);
    window.App.openModal('addModal');
  }

  document.getElementById('openAddBtn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('addFixedForm').reset();
    document.getElementById('fiDate').value = new Date().toISOString().slice(0, 10);
    setModalMode('create');
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
    const isEdit = editingId != null;
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      const payload = {
        type: document.getElementById('fiType').value,
        bank: document.getElementById('fiBank').value.trim() || undefined,
        description: document.getElementById('fiDesc').value.trim() || undefined,
        amount,
        rate,
        dateInvested: document.getElementById('fiDate').value,
        maturityDate: document.getElementById('fiMaturity').value || undefined,
      };
      if (isEdit) {
        await window.API.updateFixedIncome(editingId, payload);
        window.App.toast('Investimento atualizado!', 'success');
      } else {
        await window.API.addFixedIncome(payload);
        window.App.toast('Investimento cadastrado!', 'success');
      }
      editingId = null;
      window.App.closeModal('addModal');
      load();
    } catch (err) {
      const detail = err.details?.[0]?.message;
      window.App.toast(detail || err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = isEdit ? 'Salvar alteracoes' : 'Salvar';
    }
  });

  load();
})();
