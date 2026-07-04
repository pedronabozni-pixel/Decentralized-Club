// ==========================================================================
//  Utilidades compartilhadas: guard de autenticacao, sidebar, formatacao,
//  toasts e modais. Exposto como window.App.
// ==========================================================================
(function () {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });
  const pct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 });

  const App = {
    // ----- Formatadores -----
    fmtBRL: (v) => brl.format(Number(v) || 0),
    fmtUSD: (v) => usd.format(Number(v) || 0),
    fmtPct: (v) => `${(Number(v) || 0) >= 0 ? '+' : ''}${pct.format(Number(v) || 0)}%`,
    fmtPctAbs: (v) => `${pct.format(Number(v) || 0)}%`,
    fmtNum: (v) => num.format(Number(v) || 0),
    fmtDate: (iso) => {
      if (!iso) return '—';
      const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
      return d.toLocaleDateString('pt-BR');
    },
    signClass: (v) => (Number(v) >= 0 ? 'positive' : 'negative'),

    /**
     * Converte texto digitado em numero, aceitando formato brasileiro e
     * americano: "75.687,76" -> 75687.76 · "75,687.76" -> 75687.76 ·
     * "0,055" -> 0.055 · "0.055" -> 0.055.
     * money=true ativa a heuristica de milhar pt-BR para dinheiro:
     * "4.300" -> 4300 (mas "0.055" continua decimal).
     */
    parseDecimal(input, { money = false } = {}) {
      let s = String(input ?? '').trim().replace(/\s|US\$|R\$|\$/g, '');
      if (!s) return NaN;
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      if (lastComma !== -1 && lastDot !== -1) {
        // Os dois presentes: o que vem por ultimo e o separador decimal.
        if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
      } else if (lastComma !== -1) {
        const commas = (s.match(/,/g) || []).length;
        s = commas > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
      } else if (lastDot !== -1) {
        const dots = (s.match(/\./g) || []).length;
        if (dots > 1) s = s.replace(/\./g, ''); // 7.568.776 -> milhares
        else if (money && /^[1-9]\d{0,2}\.\d{3}$/.test(s)) s = s.replace('.', ''); // 4.300 -> 4300
        // senao: ponto unico e decimal (0.055, 107.8)
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    },

    // ----- Guard de sessao -----
    requireAuth() {
      if (!window.API.Auth.isAuthed) {
        window.location.href = '/index.html';
        return false;
      }
      return true;
    },
    logout() {
      window.API.Auth.clear();
      window.location.href = '/index.html';
    },

    // ----- Sidebar (injeta nav + nome do usuario) -----
    mountSidebar(active) {
      const user = window.API.Auth.user || {};
      const links = [
        { href: 'dashboard.html', ico: '◈', label: 'Dashboard' },
        { href: 'criptomoedas.html', ico: '₿', label: 'Criptomoedas' },
        { href: 'renda-fixa.html', ico: '▦', label: 'Renda Fixa' },
        { href: 'ativos.html', ico: '◆', label: 'Ativos' },
        { href: 'simulador.html', ico: '∿', label: 'Simulador' },
      ];
      const nav = links.map((l) => `
        <a class="nav-link ${l.href === active ? 'active' : ''}" href="${l.href}">
          <span class="ico">${l.ico}</span><span class="label">${l.label}</span>
        </a>`).join('');

      const el = document.getElementById('sidebar');
      if (!el) return;
      el.innerHTML = `
        <div class="brand">
          <div class="mark">Decentralized<span>.</span></div>
          <div class="sub">Club · Wealth</div>
        </div>
        ${nav}
        <div class="sidebar-footer">
          <div class="user-chip">
            <strong>${user.name || 'Investidor'}</strong>
            ${user.email || ''}
          </div>
          <button class="btn btn-ghost btn-sm w-full" id="logoutBtn">Sair</button>
        </div>`;
      document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    },

    // ----- Toast -----
    toast(message, type = 'info', ms = 3200) {
      let wrap = document.querySelector('.toast-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'toast-wrap';
        document.body.appendChild(wrap);
      }
      const t = document.createElement('div');
      t.className = `toast ${type}`;
      t.textContent = message;
      wrap.appendChild(t);
      setTimeout(() => {
        t.style.opacity = '0';
        t.style.transition = 'opacity .25s';
        setTimeout(() => t.remove(), 260);
      }, ms);
    },

    // ----- Modal helpers -----
    openModal(id) { document.getElementById(id)?.classList.add('open'); },
    closeModal(id) { document.getElementById(id)?.classList.remove('open'); },

    // Badge de 2-3 letras para a moeda
    symBadge: (sym) => sym.slice(0, 4),

    // Pill de variacao
    deltaPill(value, isPercent = true) {
      const up = Number(value) >= 0;
      const txt = isPercent ? this.fmtPct(value) : this.fmtBRL(value);
      return `<span class="pill ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${txt.replace('+', '')}</span>`;
    },
  };

  // Fecha modal ao clicar no overlay ou apertar ESC.
  document.addEventListener('click', (e) => {
    if (e.target.classList?.contains('modal-overlay')) e.target.classList.remove('open');
    if (e.target.dataset?.closeModal) App.closeModal(e.target.dataset.closeModal);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach((m) => m.classList.remove('open'));
  });

  window.App = App;
})();
