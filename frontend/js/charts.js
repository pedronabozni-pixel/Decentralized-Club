// ==========================================================================
//  Wrappers de graficos (Chart.js 4 via CDN) — redesign private banking.
//  Paleta harmonizada com o dourado champagne; tooltips em painel escuro
//  com hairline dourada; numeros tabulares.
// ==========================================================================
(function () {
  const GOLD = '#C9A961';
  const GOLD_BRIGHT = '#E4CD96';
  const TEXT2 = '#A29F94';
  const TEXT4 = '#6B6960';
  const TEXT5 = '#57554E';
  const GRID = 'rgba(245,245,240,0.05)';

  // Cores por classe de ativo (donut, barras, legendas).
  const CLASS_COLORS = {
    btc: '#C9A961',
    altcoins: '#98A6BE',
    renda_fixa: '#8B857A',
    bolsa_br: '#B08D57',
    internacional: '#7E9CD8',
    moedas: '#C4B590',
    fundos: '#9A8FB8',
    fisicos: '#6FA98C',
  };
  const PALETTE = ['#C9A961', '#98A6BE', '#8B857A', '#6FA98C', '#7E9CD8', '#C4B590', '#9A8FB8', '#B08D57'];

  const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const usd = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(v || 0);

  function applyDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "'Inter', sans-serif";
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
      titleFont: { family: "'Inter', sans-serif", size: 11, weight: '600' },
      bodyColor: TEXT2,
      bodyFont: { family: "'Inter', sans-serif", size: 11.5 },
      padding: 12,
      cornerRadius: 8,
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
      const fmtFn = fmt === 'pts' ? pts : (fmt === 'usd' ? usd : brl);
      const tickFn = fmt === 'brl'
        ? (v) => 'R$ ' + (v / 1000) + 'k'
        : (v) => (v >= 1000 ? pts(v / 1000) + 'k' : pts(v));
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
          responsive: true, maintainAspectRatio: false, cutout: '72%',
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
            borderRadius: 3,
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
