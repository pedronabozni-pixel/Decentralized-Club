// ==========================================================================
//  Wrappers de graficos (Chart.js 4 via CDN) — redesign private banking.
//  Paleta harmonizada com o dourado champagne; tooltips em painel escuro
//  com hairline dourada; numeros tabulares.
// ==========================================================================
(function () {
  const GOLD = '#C9A961';
  const GOLD_BRIGHT = '#C9A961';
  const TEXT2 = '#97928A';
  const TEXT4 = '#6E6A62';
  const TEXT5 = '#4E4B45';
  const GRID = 'rgba(245,245,240,0.045)';

  // Cores por classe de ativo (donut, barras, legendas).
  const CLASS_COLORS = {
    btc: '#C9A961',
    altcoins: '#F5F5F0',
    renda_fixa: '#97928A',
    bolsa_br: '#8F7439',
    internacional: '#D6C9A8',
    moedas: '#6E6A62',
    fundos: '#B5B1A8',
    fisicos: '#8F7439',
  };
  const PALETTE = ['#C9A961', '#F5F5F0', '#97928A', '#8F7439', '#D6C9A8', '#6E6A62', '#B5B1A8', '#4E4B45'];

  const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const usd = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(v || 0);

  function applyDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "'IBM Plex Mono', monospace";
    Chart.defaults.font.size = 10.5;
    Chart.defaults.color = TEXT5;
    Chart.defaults.borderColor = GRID;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.boxHeight = 8;
    Chart.defaults.plugins.legend.labels.color = TEXT4;
  }

  // Tooltip padrao: painel escuro, hairline dourada.
  function tooltip(fmt, withColors) {
    return {
      backgroundColor: 'rgba(12,12,10,0.96)',
      borderColor: 'rgba(201,169,97,0.35)',
      borderWidth: 1,
      titleColor: '#F0EAD9',
      titleFont: { family: "'IBM Plex Mono', monospace", size: 10, weight: '600' },
      bodyColor: TEXT2,
      bodyFont: { family: "'Inter', sans-serif", size: 11.5 },
      padding: 12,
      cornerRadius: 0,
      displayColors: !!withColors,
      boxWidth: 8, boxHeight: 8, boxPadding: 6,
      usePointStyle: true,
      callbacks: {
        label: (c) => {
          const value = fmt(c.parsed.y ?? c.parsed);
          return c.dataset.label ? ` ${c.dataset.label}: ${value}` : ` ${value}`;
        },
      },
    };
  }

  const instances = {};
  function destroy(id) { if (instances[id]) { instances[id].destroy(); delete instances[id]; } }

  function goldAreaGradient(ctx, area) {
    const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, 'rgba(201,169,97,0.30)');
    g.addColorStop(1, 'rgba(201,169,97,0)');
    return g;
  }

  const goldLine = {
    borderColor: GOLD,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHoverBackgroundColor: '#0A0A0A',
    pointHoverBorderColor: GOLD_BRIGHT,
    pointHoverBorderWidth: 2,
    tension: 0.35,
    fill: true,
    backgroundColor: (c) => (c.chart.chartArea
      ? goldAreaGradient(c.chart.ctx, c.chart.chartArea)
      : 'rgba(201,169,97,0.15)'),
  };

  const dashedLine = {
    borderColor: TEXT5,
    borderWidth: 1.5,
    borderDash: [3, 6],
    pointRadius: 0,
    tension: 0.2,
    fill: false,
  };

  const Charts = {
    // Linha: evolucao do patrimonio (+ serie tracejada opcional).
    // fmt: 'brl' (padrao) | 'pts' (indices) | 'usd'.
    line(canvasId, labels, values, { compare = null, fmt = 'brl', label = 'Patrimonio' } = {}) {
      applyDefaults();
      destroy(canvasId);
      const el = document.getElementById(canvasId);
      if (!el) return;
      const pts = (v) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v || 0);
      const dec2 = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
      const fmtFn = fmt === 'pts' ? pts : (fmt === 'usd' ? usd : brl);
      const tickFn = fmt === 'brl'
        ? (v) => (Math.abs(v) >= 10000 ? 'R$ ' + pts(v / 1000) + 'k' : 'R$ ' + (Math.abs(v) < 100 ? dec2(v) : pts(v)))
        : (v) => (v >= 10000 ? pts(v / 1000) + 'k' : (v < 100 ? dec2(v) : pts(v)));
      const datasets = [{ ...goldLine, label: compare ? label : '', data: values }];
      if (compare && compare.data?.length) {
        datasets.push({ ...dashedLine, label: compare.label || 'CDI', data: compare.data });
      }
      instances[canvasId] = new Chart(el, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: !!compare, position: 'top' },
            tooltip: tooltip(fmtFn, !!compare),
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: TEXT5, maxTicksLimit: 6 } },
            y: {
              grid: { color: GRID }, border: { display: false },
              ticks: { color: TEXT5, callback: tickFn },
            },
          },
        },
      });
    },

    // Linha de preco + preco medio tracejado (performance da moeda) — USD.
    lineWithAverage(canvasId, labels, priceSeries, avgPrice) {
      applyDefaults();
      destroy(canvasId);
      const el = document.getElementById(canvasId);
      if (!el) return;
      const avgLine = labels.map(() => avgPrice);
      instances[canvasId] = new Chart(el, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { ...goldLine, label: 'Preco', data: priceSeries },
            { ...dashedLine, label: 'Preco medio', data: avgLine, borderColor: '#6FA98C' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: true, position: 'top' },
            tooltip: tooltip(usd, true),
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: TEXT5, maxTicksLimit: 6 } },
            y: {
              grid: { color: GRID }, border: { display: false },
              ticks: { color: TEXT5, callback: (v) => usd(v) },
            },
          },
        },
      });
    },

    // Rosca: distribuicao da carteira.
    doughnut(canvasId, labels, values, colors) {
      applyDefaults();
      destroy(canvasId);
      const el = document.getElementById(canvasId);
      if (!el) return;
      instances[canvasId] = new Chart(el, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors || PALETTE,
            borderWidth: 0,
            spacing: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '76%',
          plugins: {
            legend: { display: false },
            tooltip: tooltip(brl, true),
          },
        },
      });
    },

    // Barras: comparativo entre classes.
    bars(canvasId, labels, values, colors) {
      applyDefaults();
      destroy(canvasId);
      const el = document.getElementById(canvasId);
      if (!el) return;
      instances[canvasId] = new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors || PALETTE,
            borderRadius: 0,
            maxBarThickness: 52,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: tooltip(brl, false),
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: TEXT4 } },
            y: {
              grid: { color: GRID }, border: { display: false },
              ticks: { color: TEXT5, callback: (v) => 'R$ ' + (v / 1000) + 'k' },
            },
          },
        },
      });
    },

    PALETTE,
    CLASS_COLORS,
    classColor(key, index) {
      return CLASS_COLORS[key] || PALETTE[index % PALETTE.length];
    },
  };

  window.Charts = Charts;
})();
