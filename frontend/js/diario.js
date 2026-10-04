// ==========================================================================
//  Pagina Diario: planos de trade de cripto. Lista filtravel por status,
//  totais, detalhe com os calculos do servidor (tradeCalc.js) e distancias
//  ate o preco atual da Binance Futures, buscado aqui no navegador.
//  Todo texto livre passa por esc() antes de entrar no HTML.
// ==========================================================================
(function () {
  if (!window.App.requireAuth()) return;
  window.App.mountSidebar('diario.html');

  const { fmtUSD, fmtPct, fmtPctAbs, fmtDate } = window.App;

  const STATUS = {
    planejado: 'Planejado', aguardando_entrada: 'Aguardando entrada', aberto: 'Aberto',
    encerrado: 'Encerrado', cancelado: 'Cancelado',
  };
  const MARKET = { perpetuo: 'Perpetuo', spot: 'Spot' };
  const DIRECTION = { compra: 'Compra', venda: 'Venda' };

  // Texto livre (call, tese, notas, descricoes, corretora) sai escapado.
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);

  // Preco pelo tamanho: acima de 1000 com centavos, acima de 1 com ate 4
  // casas, abaixo de 1 com 6 algarismos significativos (0,0585 e 0,0000123).
  const usd = (opts) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', ...opts });
  const priceBig = usd({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const priceMid = usd({ minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const priceSmall = usd({ maximumSignificantDigits: 6 });
  const priceExact = usd({ maximumFractionDigits: 12 });
  const qtyFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
  const qtySmall = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 4 });
  const fmtQty = (v) => (v > 0 ? (v >= 1 ? qtyFmt : qtySmall).format(v) : '-');
  const twoFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const levFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const fmtPrice = (v) => (!(v > 0) ? '-'
    : (v >= 1000 ? priceBig : v >= 1 ? priceMid : priceSmall).format(v));
  const fmtLev = (v) => `${levFmt.format(v)}x`;
  const tone = (v) => (v > 0 ? 'positive' : v < 0 ? 'negative' : '');
  const zone = (from, to) => `<span class="jr-nowrap">${fmtPrice(from)}</span>${to > 0 && to !== from
    ? ` a <span class="jr-nowrap">${fmtPrice(to)}</span>` : ''}`;
  // Sem capital (permitido em planejado e cancelado), nenhum calculo em US$ aparece.
  const hasCapital = (p) => p.capitalUsd > 0;
  const NO_CAPITAL = '<span class="jr-sub">defina o capital</span>';
  // Perda no stop; se a posicao liquida antes do stop, a perda e a margem inteira.
  const stopLoss = (s) => `<span class="${tone(s.effectivePnlUsd)}">${fmtUSD(s.effectivePnlUsd)}</span>${s.stopBeyondLiquidation
    ? '<span class="jr-sub negative">liquida antes do stop</span>'
    : `<span class="jr-sub">${fmtPct(s.effectivePctOfCapital)} do capital</span>`}`;
  const badge = (symbol) => window.App.symBadge(String(symbol).replace(/(USDT|USDC|BUSD)$/, '') || String(symbol));
  // Datas do banco vem em UTC ("YYYY-MM-DD HH:MM:SS").
  const fmtDateTime = (s) => (s
    ? new Date(`${s.replace(' ', 'T')}Z`).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '-');
  const localToday = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  // Numero no formato de edicao (pt-BR, sem separador de milhar).
  const toField = (v) => (v == null || v === ''
    ? ''
    : Number(v).toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 12 }));

  let plans = [];
  let loaded = false;
  let selectedId = null;
  let prices = null;    // Map par -> preco da Binance Futures (ultimo que chegou)
  let editingId = null; // null = novo plano

  const currentPrice = (symbol) => (prices && prices.get(symbol)) || null;
  // Distancia % do preco atual ate um nivel (positivo = nivel acima do preco atual).
  const dist = (current, level) => (current > 0 && level > 0 ? ((level - current) / current) * 100 : null);
  const distSub = (current, level) => {
    const d = dist(current, level);
    return d == null ? '' : `<span class="jr-sub">${fmtPct(d)} do atual</span>`;
  };

  // ---------- Carregar ----------
  async function load() {
    let data;
    try {
      data = await window.API.journalPlans();
    } catch (err) {
      // 404: o diario nao esta liberado para esta conta.
      if (err.status === 404) { window.location.href = 'dashboard.html'; return; }
      window.App.toast(err.message || 'Falha ao carregar o diario.', 'error');
      return;
    }
    plans = data.items;
    loaded = true;
    if (!plans.some((p) => p.id === selectedId)) selectedId = plans[0]?.id ?? null;
    renderKpis(data.summary);
    renderList();
    renderDetail();
  }

  function renderKpis(s) {
    document.getElementById('journalKpis').innerHTML = `
      <div class="card stat"><div class="label">Resultado realizado</div>
        <div class="stat-value serif ${tone(s.realizedTotalUsd)}">${fmtUSD(s.realizedTotalUsd)}</div>
        <div class="delta text-muted">soma dos planos encerrados</div></div>
      <div class="card stat"><div class="label">Planos encerrados</div>
        <div class="stat-value">${s.closedCount}</div>
        <div class="delta text-muted">${s.winCount} com ganho</div></div>
      <div class="card stat"><div class="label">Taxa de acerto</div>
        <div class="stat-value">${s.hitRatePct == null ? '-' : fmtPctAbs(s.hitRatePct)}</div>
        <div class="delta text-muted">sobre ${s.withResultCount} encerrado(s) com resultado</div></div>`;
  }

  // ---------- Lista ----------
  function renderList() {
    const filter = document.getElementById('statusFilter').value;
    const rows = plans.filter((p) => !filter || p.status === filter);
    const tbody = document.getElementById('plansBody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty"><div class="ico">⌖</div>${plans.length
        ? 'Nenhum plano com este status.'
        : 'Nenhum plano ainda. Clique em <strong>+ Novo plano</strong>.'}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(planRow).join('');
    tbody.querySelectorAll('.jr-plan-row').forEach((tr) => {
      tr.addEventListener('click', () => {
        selectedId = Number(tr.dataset.id);
        renderList();
        renderDetail();
        document.getElementById('planDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function planRow(p) {
    const c = p.calc;
    const cur = currentPrice(p.symbol);
    const atStop = c.ifAllFilled;
    const result = p.status === 'encerrado' && c.realized
      ? `<span class="${tone(c.realized.pnlUsd)}">${fmtUSD(c.realized.pnlUsd)}</span><br><span class="jr-sub">${fmtPct(c.realized.pnlPct)}</span>`
      : '<span class="jr-sub">-</span>';
    return `
      <tr class="jr-plan-row ${p.id === selectedId ? 'jr-selected' : ''}" data-id="${p.id}" title="Ver o plano">
        <td><div class="asset"><span class="sym-badge">${esc(badge(p.symbol))}</span>
          <div><div class="nm">${esc(p.symbol)}</div>
          <div class="sub">${esc(MARKET[p.market] || p.market)}${p.exchange ? ` · ${esc(p.exchange)}` : ''}</div></div></div></td>
        <td>${esc(DIRECTION[p.direction] || p.direction)}${p.leverage > 1 ? ` <span class="jr-sub">${fmtLev(p.leverage)}</span>` : ''}</td>
        <td><span class="jr-status ${esc(p.status)}">${esc(STATUS[p.status] || p.status)}</span></td>
        <td class="num cell-price">${cur ? fmtPrice(cur) : '<span class="jr-sub">sem preco</span>'}</td>
        <td class="num">${fmtPrice(c.avgPrice)}</td>
        <td class="num">${fmtPrice(p.stopPrice)}<br>${distSub(cur, p.stopPrice)}</td>
        <td class="num jr-stack">${!hasCapital(p) ? NO_CAPITAL : atStop ? stopLoss(atStop) : '-'}</td>
        <td class="num">${result}</td>
      </tr>`;
  }

  // ---------- Detalhe do plano ----------
  function renderDetail() {
    const box = document.getElementById('planDetail');
    const p = plans.find((x) => x.id === selectedId);
    if (!p) { box.innerHTML = ''; return; }
    const c = p.calc;
    const cur = currentPrice(p.symbol);
    const lev = p.leverage > 1;
    const capital = hasCapital(p);

    const entryRows = c.entries.length ? c.entries.map((e) => `
      <tr>
        <td>E${e.order}</td>
        <td>${zone(e.zoneFrom, e.zoneTo)}</td>
        <td class="num">${fmtUSD(e.amountUsd)}</td>
        <td class="num">${fmtPrice(e.price)}<br><span class="jr-sub">${e.filled
          ? `executada${e.eventDate ? ` em ${fmtDate(e.eventDate)}` : ''}`
          : 'ponto medio'}</span></td>
        <td class="num">${fmtQty(e.quantity)}</td>
        <td class="num ${e.toStopPct < 0 ? 'negative' : ''}">${e.toStopPct == null ? '-' : fmtPctAbs(e.toStopPct)}</td>
        <td class="num">${dist(cur, e.price) == null ? '-' : fmtPct(dist(cur, e.price))}</td>
      </tr>`).join('') : '<tr><td colspan="7" class="empty">Sem entradas.</td></tr>';

    const targetRows = c.targets.map((t) => `
      <tr>
        <td>A${t.order}</td>
        <td>${zone(t.zoneFrom, t.zoneTo)}${t.content ? `<br><span class="jr-sub">${esc(t.content)}</span>` : ''}</td>
        <td class="num">${fmtPrice(t.mid)}</td>
        <td class="num"><span class="${tone(t.returnPct)}">${t.returnPct == null ? '-' : fmtPct(t.returnPct)}</span>${lev && t.returnPctMargin != null
          ? `<br><span class="jr-sub">${fmtPct(t.returnPctMargin)} na margem</span>` : ''}</td>
        <td class="num">${t.rr == null ? '-' : twoFmt.format(t.rr)}</td>
        <td class="num">${dist(cur, t.mid) == null ? '-' : fmtPct(dist(cur, t.mid))}</td>
      </tr>`).join('');

    const all = c.ifAllFilled;
    const first = c.ifFirstOnly;
    const stopLine = (s, label) => `<dt>${label}</dt><dd>${!capital ? NO_CAPITAL
      : s ? stopLoss(s) : '<span class="jr-sub">sem entradas</span>'}</dd>`;
    const beyond = Boolean(all?.stopBeyondLiquidation || first?.stopBeyondLiquidation);
    const risk = `
      <dl class="jr-kv">
        <dt>Preco medio ponderado</dt><dd>${fmtPrice(c.avgPrice)}<span class="jr-sub">pela quantidade de moedas</span></dd>
        <dt>Stop</dt><dd>${fmtPrice(p.stopPrice)}${distSub(cur, p.stopPrice)}</dd>
        <dt>Nivel estrutural</dt><dd>${fmtPrice(p.structuralLevel)}${distSub(cur, p.structuralLevel)}</dd>
        ${stopLine(all, 'Perda se todas as entradas preencherem')}
        ${stopLine(first, 'Perda se so a 1a preencher')}
        ${all ? `<dt>Do preco medio ate o stop</dt><dd>${fmtPct(all.movePct)}${lev
          ? `<span class="jr-sub">${fmtPct(all.marginPct)} na margem (${fmtLev(p.leverage)})</span>` : ''}</dd>` : ''}
        ${lev ? `
        <dt>Liquidacao aprox., todas as entradas</dt><dd class="${all?.stopBeyondLiquidation ? 'negative' : ''}">${fmtPrice(all?.liquidation)}</dd>
        <dt>Liquidacao aprox., so a 1a</dt><dd class="${first?.stopBeyondLiquidation ? 'negative' : ''}">${fmtPrice(first?.liquidation)}</dd>` : ''}
      </dl>
      ${lev ? `<div class="jr-note-approx">Liquidacao aproximada: margem isolada, sem taxas e sem margem de manutencao. A liquidacao real acontece um pouco antes destes precos.</div>` : ''}
      ${beyond ? `<div class="jr-warn">O stop esta alem da liquidacao aproximada${all?.stopBeyondLiquidation ? '' : ' no cenario em que so a 1a entrada preenche'}: a posicao seria liquidada antes de chegar no stop, e a perda seria a margem inteira.</div>` : ''}`;

    const r = c.realized;
    const realized = r ? `
      <div class="card pad-lg mt-lg">
        <div class="jr-card-title">Resultado realizado${p.status === 'encerrado' ? '' : ' (parcial)'}</div>
        <dl class="jr-kv">
          <dt>Resultado</dt><dd>${capital
            ? `<span class="${tone(r.pnlUsd)}">${fmtUSD(r.pnlUsd)}</span><span class="jr-sub">${fmtPct(r.pnlPct)} sobre a margem usada de ${fmtUSD(r.marginUsd)}</span>`
            : NO_CAPITAL}</dd>
          <dt>Preco medio executado</dt><dd>${fmtPrice(r.avgPrice)}</dd>
          <dt>Parte da posicao encerrada</dt><dd>${fmtPctAbs(r.closedFraction * 100)}</dd>
        </dl>
        <div class="table-wrap mt-lg"><table>
          <thead><tr><th>Data</th><th class="num">Preco</th><th class="num">Fracao</th><th class="num">Resultado</th></tr></thead>
          <tbody>${r.exits.map((x) => `
            <tr><td>${x.eventDate ? fmtDate(x.eventDate) : '-'}</td><td class="num">${fmtPrice(x.price)}</td>
              <td class="num">${fmtPctAbs(x.fraction * 100)}</td><td class="num ${capital ? tone(x.pnlUsd) : ''}">${capital ? fmtUSD(x.pnlUsd) : '-'}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>` : '';

    const textBlock = (title, value) => (value
      ? `<div class="jr-card-title">${title}</div><div class="jr-text">${esc(value)}</div>` : '');
    const call = textBlock('Fonte da call', p.callSource)
      + textBlock('Texto original da call', p.callText)
      + textBlock('Tese e confluencias', p.thesis);
    const alerts = p.alerts.length ? `
      <div class="jr-card-title">Alertas na corretora</div>
      <ul class="jr-list">${p.alerts.map((a) => `
        <li><span class="jr-sub">${fmtPrice(a.price)}${dist(cur, a.price) == null ? '' : ` · ${fmtPct(dist(cur, a.price))} do atual`}</span>${esc(a.content)}</li>`).join('')}
      </ul>` : '';
    const notes = p.notes.length ? `
      <div class="jr-card-title"${alerts ? ' style="margin-top:22px;"' : ''}>Notas</div>
      <ul class="jr-list">${[...p.notes]
        .sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)))
        .map((n) => `<li><span class="jr-sub">${fmtDate(n.eventDate)}</span><div class="jr-text">${esc(n.content)}</div></li>`).join('')}
      </ul>` : '';

    box.innerHTML = `
      <div class="section-title">
        <h2>${esc(p.symbol)} · ${esc(DIRECTION[p.direction] || p.direction)}</h2>
        <span class="flex gap-sm">
          <button class="btn btn-sm btn-ghost" type="button" id="editPlanBtn">Editar</button>
          <button class="btn-icon-danger" type="button" id="deletePlanBtn" title="Excluir plano">✕</button>
        </span>
      </div>
      <div class="jr-meta">
        <span><strong>${esc(STATUS[p.status] || p.status)}</strong></span>
        <span>${esc(MARKET[p.market] || p.market)}${p.exchange ? ` · ${esc(p.exchange)}` : ''}</span>
        <span>Capital <strong>${capital ? fmtUSD(p.capitalUsd) : 'defina o capital'}</strong></span>
        <span>Alavancagem <strong>${fmtLev(p.leverage)}</strong></span>
        <span>Preco atual <strong>${cur ? fmtPrice(cur) : 'indisponivel'}</strong></span>
        <span>Criado em ${fmtDateTime(p.createdAt)}</span>
        <span>Atualizado em ${fmtDateTime(p.updatedAt)}</span>
        ${p.closedAt ? `<span>${p.status === 'cancelado' ? 'Cancelado' : 'Encerrado'} em ${fmtDateTime(p.closedAt)}</span>` : ''}
      </div>
      <div class="grid split-mid">
        <div class="card pad-lg">
          <div class="jr-card-title">Entradas</div>
          <div class="table-wrap"><table>
            <thead><tr><th>#</th><th>Zona</th><th class="num">Valor</th><th class="num">Preco usado</th>
              <th class="num">Moedas</th><th class="num">Ate o stop</th><th class="num">Do atual</th></tr></thead>
            <tbody>${entryRows}</tbody>
          </table></div>
          <div class="jr-card-title">Alvos</div>
          <div class="table-wrap"><table>
            <thead><tr><th>#</th><th>Zona</th><th class="num">Ponto medio</th><th class="num">Retorno</th>
              <th class="num">Risco/retorno</th><th class="num">Do atual</th></tr></thead>
            <tbody>${targetRows || '<tr><td colspan="6" class="empty">Sem alvos.</td></tr>'}</tbody>
          </table></div>
        </div>
        <div class="card pad-lg">
          <div class="jr-card-title">Risco</div>
          ${risk}
        </div>
      </div>
      ${realized}
      <div class="grid cols-2 mt-lg">
        <div class="card pad-lg">${call || '<div class="jr-sub">Sem call registrada.</div>'}</div>
        <div class="card pad-lg">${alerts}${notes}${alerts || notes ? '' : '<div class="jr-sub">Sem alertas nem notas.</div>'}</div>
      </div>`;

    document.getElementById('editPlanBtn').addEventListener('click', () => openPlanModal(p));
    document.getElementById('deletePlanBtn').addEventListener('click', async () => {
      if (!confirm(`Excluir o plano ${p.symbol} com todas as entradas, alvos, alertas, saidas e notas?`)) return;
      try {
        await window.API.deleteJournalPlan(p.id);
        window.App.toast('Plano excluido.', 'success');
        selectedId = null;
        await load();
      } catch (err) { window.App.toast(err.message, 'error'); }
    });
  }

  // ---------- Preco atual (Binance Futures, direto do navegador) ----------
  function setPriceBadge(ok) {
    const el = document.getElementById('priceBadge');
    el.classList.toggle('on', ok);
    el.innerHTML = `<span class="dot"></span>${ok ? 'preco · binance futures' : 'sem preco da binance'}`;
  }

  window.FuturesPrice.watch((map) => {
    if (map) prices = map; // falha momentanea mantem o ultimo preco
    setPriceBadge(Boolean(map));
    if (loaded) { renderList(); renderDetail(); }
  });

  // ---------- Formulario do plano ----------
  // Colunas de cada tipo de nivel. num: como ler o numero (price/usd/pct).
  const KINDS = {
    entrada: [
      { f: 'zoneFrom', label: 'De', num: 'price', ph: 'Ex: 0,0590' },
      { f: 'zoneTo', label: 'Ate', num: 'price', ph: 'Ex: 0,0580' },
      { f: 'amountUsd', label: 'Valor (US$)', num: 'usd', ph: 'Ex: 5' },
      { f: 'executedPrice', label: 'Preco executado', num: 'price', ph: 'Ao preencher' },
      { f: 'eventDate', label: 'Data da execucao', type: 'date' },
    ],
    alvo: [
      { f: 'zoneFrom', label: 'De', num: 'price', ph: 'Ex: 0,065' },
      { f: 'zoneTo', label: 'Ate', num: 'price', ph: 'Ex: 0,067' },
      { f: 'content', label: 'Descricao', ph: 'Opcional' },
    ],
    alerta: [
      { f: 'price', label: 'Preco', num: 'price' },
      { f: 'content', label: 'Observacao', ph: 'Opcional' },
    ],
    saida: [
      { f: 'price', label: 'Preco', num: 'price' },
      { f: 'fraction', label: 'Parte da posicao (%)', num: 'pct', ph: 'Ex: 50' },
      { f: 'eventDate', label: 'Data', type: 'date' },
    ],
    nota: [
      { f: 'eventDate', label: 'Data', type: 'date' },
      { f: 'content', label: 'Texto', type: 'textarea' },
    ],
  };

  function levelRow(kind, values = {}) {
    const cells = KINDS[kind].map((col) => {
      const raw = values[col.f];
      const value = col.num === 'pct' ? (raw == null ? '' : toField(raw * 100))
        : col.num ? toField(raw) : (raw ?? '');
      let input;
      if (col.type === 'textarea') {
        input = `<textarea class="input" data-f="${col.f}" rows="2">${esc(value)}</textarea>`;
      } else {
        const type = col.type === 'date' ? 'type="date"'
          : col.num ? 'type="text" inputmode="decimal"' : 'type="text"';
        input = `<input class="input" ${type} data-f="${col.f}"${col.num ? ` data-num="${col.num}"` : ''}
          value="${esc(value)}" placeholder="${esc(col.ph || '')}" autocomplete="off" />`;
      }
      return `<div><label>${col.label}</label>${input}${col.num ? '<div class="help jr-interp"></div>' : ''}</div>`;
    }).join('');
    return `<div class="jr-row jr-${kind}">${cells}
      <button type="button" class="btn-icon-danger jr-remove" title="Remover">✕</button></div>`;
  }

  function addRow(kind, values) {
    const box = document.getElementById(`rows-${kind}`);
    box.insertAdjacentHTML('beforeend', levelRow(kind, values));
    box.lastElementChild.querySelectorAll('[data-num]').forEach(updateInterp);
  }

  // Le um campo numerico com o leitor do app (aceita 0,0585 e 0.0585).
  function parseNum(raw, kind) {
    if (!String(raw ?? '').trim()) return null;
    return window.App.parseDecimal(raw, { money: kind === 'price' || kind === 'usd' });
  }

  function interpText(n, kind) {
    if (kind === 'price') return priceExact.format(n);
    if (kind === 'usd') return fmtUSD(n);
    if (kind === 'pct') return `${levFmt.format(n)}% da posicao`;
    return fmtLev(n);
  }

  // Mostra ao lado do campo como o numero digitado foi entendido.
  function updateInterp(input) {
    const help = input.parentElement.querySelector('.jr-interp');
    if (!help) return;
    const n = parseNum(input.value, input.dataset.num);
    const bad = Number.isNaN(n);
    help.classList.toggle('bad', bad);
    help.textContent = n == null ? '' : bad ? 'Numero nao reconhecido' : `Interpretado como ${interpText(n, input.dataset.num)}`;
  }

  async function updateSymbolHint() {
    const input = document.getElementById('pSymbol');
    const hint = document.getElementById('pSymbolHint');
    const symbol = input.value.trim().toUpperCase();
    if (!symbol) { hint.textContent = 'Par da Binance, com o USDT no fim.'; return; }
    const price = currentPrice(symbol) || await window.FuturesPrice.get(symbol);
    if (input.value.trim().toUpperCase() !== symbol) return; // ja mudou de novo
    hint.textContent = price
      ? `Preco atual na Binance Futures: ${fmtPrice(price)}`
      : 'Par nao encontrado na Binance Futures agora: o plano salva, mas sem preco atual.';
  }

  function openPlanModal(plan) {
    editingId = plan ? plan.id : null;
    const set = (id, v) => { document.getElementById(id).value = v ?? ''; };
    document.getElementById('planForm').reset();
    set('pSymbol', plan?.symbol);
    set('pMarket', plan?.market || 'perpetuo');
    set('pExchange', plan?.exchange);
    set('pDirection', plan?.direction || 'compra');
    set('pStatus', plan?.status || 'planejado');
    set('pCapital', toField(plan?.capitalUsd));
    set('pLeverage', toField(plan?.leverage ?? 1));
    set('pStructural', toField(plan?.structuralLevel));
    set('pStop', toField(plan?.stopPrice));
    set('pCallSource', plan?.callSource);
    set('pCallText', plan?.callText);
    set('pThesis', plan?.thesis);
    for (const kind of Object.keys(KINDS)) document.getElementById(`rows-${kind}`).innerHTML = '';
    (plan?.entries?.length ? plan.entries : [{}]).forEach((e) => addRow('entrada', e));
    (plan?.targets?.length ? plan.targets : [{}]).forEach((t) => addRow('alvo', t));
    (plan?.alerts || []).forEach((a) => addRow('alerta', a));
    (plan?.exits || []).forEach((x) => addRow('saida', x));
    (plan?.notes || []).forEach((n) => addRow('nota', n));
    document.querySelectorAll('#pCapital, #pLeverage, #pStructural, #pStop').forEach(updateInterp);
    document.getElementById('planModalTitle').textContent = plan ? `Editar plano · ${plan.symbol}` : 'Novo plano';
    document.getElementById('planSubmit').textContent = plan ? 'Salvar alteracoes' : 'Salvar plano';
    updateSymbolHint();
    window.App.openModal('planModal');
  }

  // Linhas preenchidas de um tipo (linha so com a data e ignorada).
  function readRows(kind) {
    return [...document.querySelectorAll(`#rows-${kind} .jr-row`)]
      .map((row) => {
        const out = {};
        row.querySelectorAll('[data-f]').forEach((el) => {
          out[el.dataset.f] = el.dataset.num ? parseNum(el.value, el.dataset.num) : (el.value.trim() || null);
        });
        return out;
      })
      .filter((r) => Object.entries(r).some(([k, v]) => k !== 'eventDate' && v != null));
  }

  function buildPayload() {
    const val = (id) => document.getElementById(id).value;
    const num = (id) => { const el = document.getElementById(id); return parseNum(el.value, el.dataset.num); };
    return {
      symbol: val('pSymbol').trim().toUpperCase(),
      market: val('pMarket'),
      exchange: val('pExchange'),
      direction: val('pDirection'),
      status: val('pStatus'),
      callSource: val('pCallSource'),
      callText: val('pCallText'),
      thesis: val('pThesis'),
      capitalUsd: num('pCapital'),
      leverage: num('pLeverage') ?? 1,
      structuralLevel: num('pStructural'),
      stopPrice: num('pStop'),
      entries: readRows('entrada'),
      targets: readRows('alvo'),
      alerts: readRows('alerta'),
      exits: readRows('saida').map((x) => ({ ...x, fraction: x.fraction == null ? null : x.fraction / 100 })),
      notes: readRows('nota'),
    };
  }

  // Mesma trava de crypto-manager.js: preco digitado a mais de 3x do mercado
  // (para cima ou para baixo) pede confirmacao. O mercado aqui e a Binance
  // Futures, buscada no navegador; sem preco, segue sem a checagem.
  async function confirmFarFromMarket(payload) {
    const market = await window.FuturesPrice.get(payload.symbol);
    if (!(market > 0)) return true;
    const checks = [
      ['Stop', payload.stopPrice],
      ['Nivel estrutural', payload.structuralLevel],
      ...payload.entries.flatMap((e, i) => [
        [`Entrada ${i + 1} (de)`, e.zoneFrom], [`Entrada ${i + 1} (ate)`, e.zoneTo], [`Entrada ${i + 1} (executado)`, e.executedPrice],
      ]),
      ...payload.targets.flatMap((t, i) => [[`Alvo ${i + 1} (de)`, t.zoneFrom], [`Alvo ${i + 1} (ate)`, t.zoneTo]]),
      ...payload.alerts.map((a, i) => [`Alerta ${i + 1}`, a.price]),
      ...payload.exits.map((x, i) => [`Saida ${i + 1}`, x.price]),
    ];
    const far = checks.filter(([, v]) => v > 0 && (v / market > 3 || v / market < 1 / 3));
    if (!far.length) return true;
    return confirm(
      `Atencao: o preco atual de ${payload.symbol} na Binance Futures e ${fmtPrice(market)}, `
      + `e estes precos estao a mais de 3x dele:\n\n${far.map(([l, v]) => `${l}: ${fmtPrice(v)}`).join('\n')}\n\n`
      + 'Confirma os precos digitados?'
    );
  }

  const form = document.getElementById('planForm');

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.num) updateInterp(t);
    // Ao preencher o preco executado, a data da execucao vem com hoje.
    if (t.dataset.f === 'executedPrice' && t.value.trim()) {
      const date = t.closest('.jr-row').querySelector('[data-f="eventDate"]');
      if (date && !date.value) date.value = localToday();
    }
  });

  form.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const kind = add.dataset.add;
      addRow(kind, kind === 'nota' || kind === 'saida' ? { eventDate: localToday() } : {});
      return;
    }
    const remove = e.target.closest('.jr-remove');
    if (remove) remove.closest('.jr-row').remove();
  });

  let symbolTimer;
  document.getElementById('pSymbol').addEventListener('input', () => {
    clearTimeout(symbolTimer);
    symbolTimer = setTimeout(updateSymbolHint, 450);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const toast = (msg) => window.App.toast(msg, 'error');
    if (form.querySelector('.jr-interp.bad')) { toast('Ha numero que nao foi reconhecido. Confira os campos marcados.'); return; }
    const payload = buildPayload();
    if (!payload.symbol) { toast('Informe o ativo (ex: MANTAUSDT).'); return; }
    if (!(payload.stopPrice > 0)) { toast('Informe o stop.'); return; }
    // Capital e entradas dependem do status: quem decide e o servidor.

    const btn = document.getElementById('planSubmit');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      if (!(await confirmFarFromMarket(payload))) return;
      const res = editingId != null
        ? await window.API.updateJournalPlan(editingId, payload)
        : await window.API.addJournalPlan(payload);
      window.App.toast(editingId != null ? 'Plano atualizado!' : 'Plano registrado!', 'success');
      window.App.closeModal('planModal');
      selectedId = res.item.id;
      editingId = null;
      await load();
    } catch (err) {
      toast(err.details?.map((d) => d.message).join(' ') || err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  document.getElementById('statusFilter').addEventListener('change', renderList);
  document.getElementById('newPlanBtn').addEventListener('click', () => openPlanModal(null));

  load();
})();
