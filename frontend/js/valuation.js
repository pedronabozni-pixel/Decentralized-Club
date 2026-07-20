// ==========================================================================
//  Pagina Valuation: DCF, multiplos, Graham e Gordon. Calculos no cliente,
//  com opcao de salvar o resultado como participacao em negocio (Ativos).
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('valuation.html');

  const { fmtBRL, parseDecimal } = window.App;
  const $ = (id) => document.getElementById(id);
  const val = (id, opts) => parseDecimal($(id).value, opts);

  // ---------- Troca de metodo ----------
  const forms = { dcf: 'formDcf', multiples: 'formMultiples', graham: 'formGraham', gordon: 'formGordon' };
  document.getElementById('methodTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.range-tab');
    if (!tab) return;
    document.querySelectorAll('#methodTabs .range-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    Object.values(forms).forEach((f) => $(f).classList.add('hidden'));
    $(forms[tab.dataset.method]).classList.remove('hidden');
  });

  // ---------- Render do resultado ----------
  function renderResult({ title, mainLabel, mainValue, rows, saveValue, saveName }) {
    $('valResult').innerHTML = `
      <div class="card stat" style="background:var(--color-bg);margin-bottom:18px;">
        <span class="accent-line"></span>
        <div class="label">${mainLabel}</div>
        <div class="stat-value serif text-gold">${fmtBRL(mainValue)}</div>
        <div class="delta text-muted">${title}</div>
      </div>
      <table><tbody>
        ${rows.map(([k, v, cls]) => `
          <tr><td class="text-muted">${k}</td>
          <td class="num ${cls || ''}">${v}</td></tr>`).join('')}
      </tbody></table>
      ${saveValue > 0 ? `
        <button class="btn btn-ghost w-full mt-lg" id="saveAsAsset"
          data-value="${saveValue}" data-name="${saveName}">
          Salvar como participacao em negocio →
        </button>` : ''}`;

    const saveBtn = $('saveAsAsset');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const name = prompt('Nome do negocio:', saveBtn.dataset.name || 'Empresa avaliada');
        if (!name) return;
        const investedRaw = prompt('Quanto voce investiu nele? (R$, 0 se nada)', '0');
        const invested = parseDecimal(investedRaw || '0', { money: true });
        try {
          await window.API.addAsset({
            category: 'negocio', name: name.trim(),
            invested: invested >= 0 ? invested : 0,
            currentValue: Number(saveBtn.dataset.value),
            purchaseDate: new Date().toISOString().slice(0, 10),
            notes: 'Valuation feito na plataforma',
          });
          window.App.toast('Salvo em Ativos!', 'success');
        } catch (err) { window.App.toast(err.message, 'error'); }
      });
    }
  }

  function marginRow(fair, price) {
    if (!(price > 0)) return [];
    const margin = ((fair - price) / price) * 100;
    const cls = margin >= 0 ? 'positive' : 'negative';
    const label = margin >= 0 ? 'acima do preco atual (margem)' : 'abaixo do preco atual';
    return [[`Preco atual vs valor justo`, `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}% ${label}`, cls]];
  }

  // ---------- DCF ----------
  $('formDcf').addEventListener('submit', (e) => {
    e.preventDefault();
    const fcf = val('dcfFcf', { money: true });
    const g1 = val('dcfGrowth') / 100;
    const gPerp = val('dcfPerp') / 100;
    const r = val('dcfDiscount') / 100;
    const debt = $('dcfDebt').value.trim() ? val('dcfDebt', { money: true }) : 0;
    if (!(fcf > 0)) { window.App.toast('Fluxo de caixa invalido.', 'error'); return; }
    if (r <= gPerp) { window.App.toast('A taxa de desconto precisa ser maior que o crescimento perpetuo.', 'error'); return; }

    // 5 anos explicitos + valor terminal (perpetuidade de Gordon).
    let pv = 0;
    let flow = fcf;
    for (let year = 1; year <= 5; year++) {
      flow *= 1 + g1;
      pv += flow / Math.pow(1 + r, year);
    }
    const terminal = (flow * (1 + gPerp)) / (r - gPerp);
    const pvTerminal = terminal / Math.pow(1 + r, 5);
    const enterprise = pv + pvTerminal;
    const equity = enterprise - debt;

    renderResult({
      title: 'Fluxo de caixa descontado (5 anos + perpetuidade)',
      mainLabel: 'Valor da empresa (equity)',
      mainValue: equity,
      rows: [
        ['Valor presente dos 5 anos', fmtBRL(pv)],
        ['Valor terminal (perpetuidade)', fmtBRL(pvTerminal)],
        ['Valor da operacao (EV)', fmtBRL(enterprise)],
        ['(-) Divida liquida', fmtBRL(debt)],
        ['Multiplo implicito (EV/FCF)', `${(enterprise / fcf).toFixed(1)}x`],
      ],
      saveValue: Math.max(0, equity),
      saveName: 'Empresa (DCF)',
    });
  });

  // ---------- Multiplos ----------
  $('formMultiples').addEventListener('submit', (e) => {
    e.preventDefault();
    const profit = val('mulProfit', { money: true });
    const pe = val('mulPe');
    const debt = $('mulDebt').value.trim() ? val('mulDebt', { money: true }) : 0;
    if (!(profit > 0) || !(pe > 0)) { window.App.toast('Preencha lucro e multiplo validos.', 'error'); return; }
    const enterprise = profit * pe;
    const equity = enterprise - debt;
    renderResult({
      title: `Multiplos de mercado (P/L ${pe.toFixed(1)}x)`,
      mainLabel: 'Valor da empresa',
      mainValue: equity,
      rows: [
        ['Lucro anual', fmtBRL(profit)],
        ['Multiplo aplicado', `${pe.toFixed(1)}x`],
        ['Valor bruto', fmtBRL(enterprise)],
        ['(-) Divida liquida', fmtBRL(debt)],
        ['Payback implicito', `${pe.toFixed(1)} anos de lucro`],
      ],
      saveValue: Math.max(0, equity),
      saveName: 'Empresa (multiplos)',
    });
  });

  // ---------- Graham ----------
  $('formGraham').addEventListener('submit', (e) => {
    e.preventDefault();
    const lpa = val('grahamLpa', { money: true });
    const vpa = val('grahamVpa', { money: true });
    const price = $('grahamPrice').value.trim() ? val('grahamPrice', { money: true }) : 0;
    if (!(lpa > 0) || !(vpa > 0)) { window.App.toast('LPA e VPA precisam ser positivos.', 'error'); return; }
    const fair = Math.sqrt(22.5 * lpa * vpa);
    renderResult({
      title: 'Formula de Graham — √(22,5 × LPA × VPA)',
      mainLabel: 'Valor intrinseco por acao',
      mainValue: fair,
      rows: [
        ['LPA', fmtBRL(lpa)],
        ['VPA', fmtBRL(vpa)],
        ['P/L implicito no teto', `${(fair / lpa).toFixed(1)}x`],
        ...marginRow(fair, price),
      ],
      saveValue: 0,
    });
  });

  // ---------- Gordon ----------
  $('formGordon').addEventListener('submit', (e) => {
    e.preventDefault();
    const div = val('gordonDiv', { money: true });
    const r = val('gordonR') / 100;
    const g = val('gordonG') / 100;
    const price = $('gordonPrice').value.trim() ? val('gordonPrice', { money: true }) : 0;
    if (!(div > 0)) { window.App.toast('Dividendo invalido.', 'error'); return; }
    if (r <= g) { window.App.toast('O retorno exigido precisa ser maior que o crescimento.', 'error'); return; }
    const fair = (div * (1 + g)) / (r - g);
    renderResult({
      title: 'Modelo de Gordon — D1 ÷ (r − g)',
      mainLabel: 'Preco justo por acao',
      mainValue: fair,
      rows: [
        ['Dividendo projetado (D1)', fmtBRL(div * (1 + g))],
        ['Yield implicito no preco justo', `${((div * (1 + g)) / fair * 100).toFixed(2)}%`],
        ...marginRow(fair, price),
      ],
      saveValue: 0,
    });
  });
})();
