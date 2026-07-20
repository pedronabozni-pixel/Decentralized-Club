// ==========================================================================
//  Pagina Metas: objetivos futuros com progresso, prazo e o aporte mensal
//  necessario (juros compostos) para chegar la.
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('metas.html');

  const { fmtBRL, fmtDate, parseDecimal } = window.App;

  async function load() {
    let data;
    try {
      data = await window.API.goals();
    } catch (err) {
      window.App.toast(err.message || 'Falha ao carregar metas.', 'error');
      return;
    }
    renderKpis(data.summary);
    renderGoals(data.items);
  }

  function renderKpis(s) {
    document.getElementById('goalKpis').innerHTML = `
      <div class="card stat"><span class="accent-line"></span>
        <div class="label">Soma das metas</div>
        <div class="stat-value serif">${fmtBRL(s.totalTarget)}</div>
        <div class="delta text-muted">${s.count} meta${s.count === 1 ? '' : 's'}</div></div>
      <div class="card stat"><div class="label">Ja reservado</div>
        <div class="stat-value">${fmtBRL(s.totalSaved)}</div></div>
      <div class="card stat"><div class="label">Aporte mensal necessario</div>
        <div class="stat-value text-gold">${fmtBRL(s.totalRequiredMonthly)}</div>
        <div class="delta text-muted">somando todas as metas</div></div>`;
  }

  function renderGoals(items) {
    const wrap = document.getElementById('goalsList');
    if (!items.length) {
      wrap.innerHTML = `<div class="card" style="grid-column:1/-1;"><div class="empty">
        <div class="ico">◎</div>Nenhuma meta ainda. Defina onde voce quer chegar em
        <strong>+ Nova meta</strong>.</div></div>`;
      return;
    }

    wrap.innerHTML = items.map((g) => {
      const pct = Math.min(100, g.progressPercent);
      const prazo = g.overdue
        ? '<span class="negative">prazo vencido</span>'
        : `${g.monthsLeft} ${g.monthsLeft === 1 ? 'mes' : 'meses'} restantes`;
      const aporte = g.requiredMonthly == null
        ? '—'
        : (g.requiredMonthly === 0 ? 'Nenhum (rendimento ja basta)' : `${fmtBRL(g.requiredMonthly)}/mes`);
      return `
      <div class="card pad-lg">
        <div class="flex justify-between items-center" style="margin-bottom:6px;">
          <h3 style="font-size:1.25rem;">${g.name}</h3>
          <button class="btn-icon-danger del-goal" data-id="${g.id}" title="Excluir">✕</button>
        </div>
        <div class="text-muted" style="font-size:.82rem;margin-bottom:16px;">
          Alvo: ${fmtBRL(g.target_amount)} ate ${fmtDate(g.target_date)} · ${prazo}
        </div>
        <div class="alloc-bar" style="height:9px;margin-bottom:8px;">
          <span style="width:${pct}%;background:var(--color-gold);"></span>
        </div>
        <div class="flex justify-between" style="font-size:.85rem;margin-bottom:16px;">
          <span>${fmtBRL(g.initial_amount)} <span class="text-muted">guardado</span></span>
          <span class="text-gold">${pct.toFixed(1)}%</span>
        </div>
        <div class="card" style="background:var(--color-bg);padding:14px;margin-bottom:14px;">
          <div class="flex justify-between">
            <span class="text-muted">Aporte necessario</span>
            <strong class="text-gold">${aporte}</strong>
          </div>
          <div class="flex justify-between" style="margin-top:6px;">
            <span class="text-muted">Rendimento esperado</span>
            <span>${Number(g.expected_rate).toFixed(1)}% a.a.</span>
          </div>
        </div>
        ${g.notes ? `<div class="text-muted" style="font-size:.8rem;margin-bottom:12px;">${g.notes}</div>` : ''}
        <button class="btn btn-ghost btn-sm w-full upd-goal" data-id="${g.id}" data-name="${g.name}">
          Atualizar progresso
        </button>
      </div>`;
    }).join('');

    wrap.querySelectorAll('.del-goal').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir esta meta?')) return;
        try {
          await window.API.deleteGoal(btn.dataset.id);
          window.App.toast('Meta excluida.', 'success');
          load();
        } catch (err) { window.App.toast(err.message, 'error'); }
      });
    });
    wrap.querySelectorAll('.upd-goal').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('progGoalId').value = btn.dataset.id;
        document.getElementById('progGoalName').textContent = btn.dataset.name;
        document.getElementById('progValue').value = '';
        window.App.openModal('progressModal');
        setTimeout(() => document.getElementById('progValue').focus(), 100);
      });
    });
  }

  // ---------- Sugestao de taxa via SELIC ----------
  (async () => {
    try {
      const s = await window.API.selic();
      if (s.selic) {
        document.getElementById('goalRateHelp').textContent =
          `Referencia: SELIC atual ${Number(s.selic).toFixed(2)}% a.a.`;
      }
    } catch { /* silencioso */ }
  })();

  // ---------- Nova meta ----------
  document.getElementById('openAddBtn').addEventListener('click', () => {
    document.getElementById('addGoalForm').reset();
    document.getElementById('goalRate').value = '10';
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    document.getElementById('goalDate').value = oneYear.toISOString().slice(0, 10);
    window.App.openModal('addModal');
  });

  document.getElementById('addGoalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const target = parseDecimal(document.getElementById('goalTarget').value, { money: true });
    if (!(target > 0)) { window.App.toast('Valor da meta invalido.', 'error'); return; }
    const initialRaw = document.getElementById('goalInitial').value.trim();
    const initial = initialRaw ? parseDecimal(initialRaw, { money: true }) : 0;
    if (!(initial >= 0)) { window.App.toast('Valor guardado invalido.', 'error'); return; }
    const rate = parseDecimal(document.getElementById('goalRate').value);
    if (!(rate >= 0)) { window.App.toast('Taxa invalida.', 'error'); return; }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Criando...';
    try {
      await window.API.addGoal({
        name: document.getElementById('goalName').value.trim(),
        targetAmount: target,
        targetDate: document.getElementById('goalDate').value,
        expectedRate: rate,
        initialAmount: initial,
        notes: document.getElementById('goalNotes').value.trim() || undefined,
      });
      window.App.toast('Meta criada!', 'success');
      window.App.closeModal('addModal');
      load();
    } catch (err) {
      const detail = err.details?.[0]?.message;
      window.App.toast(detail || err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Criar meta';
    }
  });

  // ---------- Atualizar progresso ----------
  document.getElementById('progressForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = parseDecimal(document.getElementById('progValue').value, { money: true });
    if (!(value >= 0)) { window.App.toast('Valor invalido.', 'error'); return; }
    try {
      await window.API.updateGoalProgress(document.getElementById('progGoalId').value, value);
      window.App.toast('Progresso atualizado!', 'success');
      window.App.closeModal('progressModal');
      load();
    } catch (err) { window.App.toast(err.message, 'error'); }
  });

  load();
})();
