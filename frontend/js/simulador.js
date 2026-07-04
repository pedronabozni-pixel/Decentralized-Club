// ==========================================================================
//  Simulador de juros (renda fixa): bruto, IR, liquido e total.
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('simulador.html');

  const { fmtBRL } = window.App;

  // Sugestao de taxa via SELIC.
  (async () => {
    try {
      const s = await window.API.selic();
      if (s.selic) {
        document.getElementById('selicHelp').innerHTML =
          `SELIC atual: <a class="text-gold" id="useSelic" style="cursor:pointer;">${Number(s.selic).toFixed(2)}% a.a.</a>`;
        document.getElementById('useSelic').addEventListener('click', () => {
          document.getElementById('simRate').value = Number(s.selic).toFixed(2);
        });
      } else {
        document.getElementById('selicHelp').textContent = 'Dica: consulte a taxa do seu titulo.';
      }
    } catch {
      document.getElementById('selicHelp').textContent = 'Dica: consulte a taxa do seu titulo.';
    }
  })();

  document.getElementById('simForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Aceita formato brasileiro (10.000,00 / 11,5) e americano.
    const amount = window.App.parseDecimal(document.getElementById('simAmount').value, { money: true });
    const rate = window.App.parseDecimal(document.getElementById('simRate').value);
    const period = Number(document.getElementById('simPeriod').value);
    if (!(amount > 0)) { window.App.toast('Valor inicial invalido.', 'error'); return; }
    if (!(rate >= 0)) { window.App.toast('Taxa invalida.', 'error'); return; }
    const unit = Number(document.getElementById('simUnit').value);
    const type = document.getElementById('simType').value;
    const periodDays = Math.round(period * unit);

    try {
      const { result } = await window.API.simulate({ amount, rate, periodDays, type });
      render(result);
    } catch (err) {
      window.App.toast(err.message || 'Falha na simulacao.', 'error');
    }
  });

  function render(r) {
    const years = (r.days / 365);
    const periodLabel = years >= 1 ? `${years.toFixed(1)} anos` : `${r.days} dias`;
    const yieldPct = r.principal > 0 ? (r.netYield / r.principal) * 100 : 0;

    document.getElementById('simResult').innerHTML = `
      <div class="card stat" style="background:var(--color-bg);margin-bottom:18px;">
        <span class="accent-line"></span>
        <div class="label">Valor liquido final</div>
        <div class="stat-value serif text-gold">${fmtBRL(r.total)}</div>
        <div class="delta positive">+${fmtBRL(r.netYield)} liquido (${yieldPct.toFixed(2)}%) em ${periodLabel}</div>
      </div>

      <table>
        <tbody>
          <tr><td class="text-muted">Valor investido</td><td class="num">${fmtBRL(r.principal)}</td></tr>
          <tr><td class="text-muted">Rendimento bruto</td><td class="num positive">${fmtBRL(r.grossYield)}</td></tr>
          <tr><td class="text-muted">Imposto de renda (${(r.irRate * 100).toFixed(1)}%)</td><td class="num negative">- ${fmtBRL(r.irAmount)}</td></tr>
          <tr><td class="text-muted">Rendimento liquido</td><td class="num positive">${fmtBRL(r.netYield)}</td></tr>
          <tr><td><strong>Total liquido</strong></td><td class="num"><strong>${fmtBRL(r.total)}</strong></td></tr>
        </tbody>
      </table>`;
  }
})();
