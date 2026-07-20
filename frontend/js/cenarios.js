// ==========================================================================
//  Pagina Cenarios: stress test da carteira real do usuario.
//  Aplica choques por classe de ativo, mostra o impacto e calcula o
//  Score de Resiliencia (0-100). Diferencial da plataforma.
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('cenarios.html');

  const { fmtBRL, fmtPct } = window.App;

  // Classes de ativo (chaves iguais as do allocation.groups do backend).
  const CLASSES = [
    { key: 'btc', label: 'Bitcoin' },
    { key: 'altcoins', label: 'Altcoins' },
    { key: 'renda_fixa', label: 'Renda Fixa' },
    { key: 'bolsa_br', label: 'Bolsa Brasil' },
    { key: 'internacional', label: 'Internacional' },
    { key: 'moedas', label: 'Moedas e Metais' },
    { key: 'fundos', label: 'Fundos' },
    { key: 'fisicos', label: 'Fisicos' },
  ];

  // Presets de choque (% de variacao por classe).
  const PRESETS = {
    crise2008: {
      desc: 'Crise financeira global: bolsas despencam, cripto derrete, imoveis caem, dolar sobe.',
      shocks: { btc: -50, altcoins: -65, renda_fixa: 0, bolsa_br: -40, internacional: -35, moedas: 20, fundos: -25, fisicos: -15 },
    },
    cryptowinter: {
      desc: 'Inverno cripto: BTC e altcoins em queda profunda, resto do mercado estavel.',
      shocks: { btc: -60, altcoins: -80, renda_fixa: 0, bolsa_br: -5, internacional: 0, moedas: 5, fundos: 0, fisicos: 0 },
    },
    dolarforte: {
      desc: 'Dolar disparando: ativos dolarizados sobem, bolsa local sofre, inflacao pressiona.',
      shocks: { btc: 15, altcoins: 10, renda_fixa: 0, bolsa_br: -15, internacional: 25, moedas: 30, fundos: -5, fisicos: 5 },
    },
    inflacao: {
      desc: 'Inflacao alta persistente: renda fixa prefixada perde valor real, ativos reais seguram.',
      shocks: { btc: 10, altcoins: 0, renda_fixa: -8, bolsa_br: -10, internacional: 5, moedas: 15, fundos: -5, fisicos: 10 },
    },
    custom: {
      desc: 'Ajuste cada choque manualmente e veja o impacto em tempo real.',
      shocks: { btc: 0, altcoins: 0, renda_fixa: 0, bolsa_br: 0, internacional: 0, moedas: 0, fundos: 0, fisicos: 0 },
    },
  };

  // Cenario severo padrao usado no Score (fixo, independente dos sliders).
  const SEVERE = PRESETS.crise2008.shocks;

  let portfolio = null; // { total, byClass: { key: value } }

  // ---------- Carrega a carteira ----------
  async function load() {
    let data;
    try {
      data = await window.API.portfolio();
    } catch (err) {
      window.App.toast(err.message || 'Falha ao carregar carteira.', 'error');
      return;
    }
    const byClass = {};
    for (const g of data.allocation.groups) byClass[g.key] = g.value;
    portfolio = { total: data.totalValue, byClass };

    renderScore();
    buildSliders(PRESETS.crise2008.shocks);
    document.getElementById('presetDesc').textContent = PRESETS.crise2008.desc;
    applyShocks();
  }

  // ---------- Score de Resiliencia ----------
  function computeScore() {
    if (!portfolio || portfolio.total <= 0) return { score: 0, severeLoss: 0 };
    // 1) Perda no cenario severo (70% do score).
    let after = 0;
    for (const c of CLASSES) {
      const v = portfolio.byClass[c.key] || 0;
      after += v * (1 + (SEVERE[c.key] || 0) / 100);
    }
    const lossPct = Math.max(0, (portfolio.total - after) / portfolio.total); // 0..1
    const survival = 1 - lossPct;
    // 2) Diversificacao via indice Herfindahl (30% do score).
    const shares = CLASSES.map((c) => (portfolio.byClass[c.key] || 0) / portfolio.total);
    const hhi = shares.reduce((s, x) => s + x * x, 0); // 1 = tudo numa classe
    const maxDivers = 1 - 1 / CLASSES.length;
    const diversification = maxDivers > 0 ? (1 - hhi) / maxDivers : 0;

    const score = Math.round(Math.min(100, Math.max(0, survival * 70 + diversification * 30)));
    return { score, severeLoss: portfolio.total - after, severeLossPct: lossPct * 100 };
  }

  function grade(score) {
    if (score >= 80) return { label: 'Resiliente', cls: 'positive' };
    if (score >= 60) return { label: 'Moderada', cls: 'text-gold' };
    if (score >= 40) return { label: 'Vulneravel', cls: 'negative' };
    return { label: 'Critica', cls: 'negative' };
  }

  function renderScore() {
    const { score, severeLoss, severeLossPct } = computeScore();
    const g = grade(score);
    document.getElementById('scoreRow').innerHTML = `
      <div class="card stat"><span class="accent-line"></span>
        <div class="label">Score de resiliencia</div>
        <div class="stat-value serif">${score}<span style="font-size:1.1rem;color:var(--color-text-faint);">/100</span></div>
        <div class="delta ${g.cls}">Carteira ${g.label.toLowerCase()}</div></div>
      <div class="card stat"><div class="label">Patrimonio atual</div>
        <div class="stat-value">${fmtBRL(portfolio.total)}</div></div>
      <div class="card stat"><div class="label">Perda em crise severa</div>
        <div class="stat-value negative">${fmtBRL(-severeLoss)}</div>
        <div class="delta negative">${fmtPct(-severeLossPct)}</div></div>`;
  }

  // ---------- Sliders ----------
  function buildSliders(shocks) {
    const wrap = document.getElementById('shockSliders');
    wrap.innerHTML = CLASSES.map((c) => {
      const value = portfolio.byClass[c.key] || 0;
      const has = value > 0;
      return `
      <div class="field" style="${has ? '' : 'opacity:.4;'}">
        <div class="flex justify-between" style="margin-bottom:6px;">
          <label style="margin:0;">${c.label}
            <span class="text-muted" style="font-size:.72rem;">${has ? fmtBRL(value) : 'sem posicao'}</span>
          </label>
          <strong id="shockVal_${c.key}" class="mono" style="font-size:.85rem;">${shocks[c.key] > 0 ? '+' : ''}${shocks[c.key]}%</strong>
        </div>
        <input type="range" min="-90" max="90" step="5" value="${shocks[c.key]}"
          id="shock_${c.key}" style="width:100%;accent-color:var(--color-gold);" ${has ? '' : 'disabled'} />
      </div>`;
    }).join('');

    CLASSES.forEach((c) => {
      const slider = document.getElementById(`shock_${c.key}`);
      slider.addEventListener('input', () => {
        document.getElementById(`shockVal_${c.key}`).textContent =
          `${slider.value > 0 ? '+' : ''}${slider.value}%`;
        // Mexer no slider muda para o modo personalizado.
        document.querySelectorAll('#presetTabs .range-tab').forEach((t) => t.classList.remove('active'));
        document.querySelector('#presetTabs [data-preset="custom"]').classList.add('active');
        document.getElementById('presetDesc').textContent = PRESETS.custom.desc;
        applyShocks();
      });
    });
  }

  function currentShocks() {
    const shocks = {};
    for (const c of CLASSES) {
      shocks[c.key] = Number(document.getElementById(`shock_${c.key}`)?.value || 0);
    }
    return shocks;
  }

  // ---------- Aplicar choques ----------
  function applyShocks() {
    if (!portfolio) return;
    const shocks = currentShocks();
    let after = 0;
    const perClass = [];
    for (const c of CLASSES) {
      const before = portfolio.byClass[c.key] || 0;
      if (before <= 0) continue;
      const shocked = before * (1 + shocks[c.key] / 100);
      after += shocked;
      perClass.push({ ...c, before, after: shocked, delta: shocked - before });
    }
    const delta = after - portfolio.total;
    const deltaPct = portfolio.total > 0 ? (delta / portfolio.total) * 100 : 0;
    const cls = delta >= 0 ? 'positive' : 'negative';

    document.getElementById('impactResult').innerHTML = `
      <div class="card stat" style="background:var(--color-bg);margin-bottom:18px;">
        <span class="accent-line"></span>
        <div class="label">Patrimonio apos o cenario</div>
        <div class="stat-value serif">${fmtBRL(after)}</div>
        <div class="delta ${cls}">${fmtBRL(delta)} (${fmtPct(deltaPct)})</div>
      </div>
      ${perClass.map((p) => {
        const pctChange = (p.delta / p.before) * 100;
        const width = Math.min(100, Math.abs(pctChange));
        const barColor = p.delta >= 0 ? 'var(--color-positive)' : 'var(--color-negative)';
        return `
        <div style="margin-bottom:14px;">
          <div class="flex justify-between" style="font-size:.85rem;margin-bottom:4px;">
            <span>${p.label}</span>
            <span class="${p.delta >= 0 ? 'positive' : 'negative'}">${fmtBRL(p.delta)} (${fmtPct(pctChange)})</span>
          </div>
          <div class="alloc-bar"><span style="width:${width}%;background:${barColor};"></span></div>
        </div>`;
      }).join('')}`;
  }

  // ---------- Presets ----------
  document.getElementById('presetTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.range-tab');
    if (!tab) return;
    document.querySelectorAll('#presetTabs .range-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const preset = PRESETS[tab.dataset.preset];
    document.getElementById('presetDesc').textContent = preset.desc;
    buildSliders(preset.shocks);
    applyShocks();
  });

  load();
})();
