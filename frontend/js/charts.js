// ==========================================================================
//  Wrappers de graficos (Chart.js via CDN). Tema dark + dourado champagne.
//  Exposto como window.Charts.
// ==========================================================================
(function () {
  const GOLD = '#C9A961';
  const TEXT = '#9A9A93';
  const GRID = 'rgba(255,255,255,0.05)';
  const POSITIVE = '#5FB98E';
  const PALETTE = ['#C9A961', '#7E9CD8', '#9A9A93', '#5FB98E', '#D8736B', '#B58FCB', '#E0B973'];

  const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const usd = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(v || 0);

  // Defaults globais (aplicados se Chart estiver disponivel).
  function applyDefaults() {
    if (!window.Chart) return;
    Chart.defaults.color = TEXT;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11;
  }

  const instances = {};
  function destroy(id) { if (instances[id]) { instances[id].destroy(); delete instances[id]; } }

  // Gradiente vertical para area dos graficos de linha.
  function goldGradient(ctx, area, color = GOLD) {
    const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, color + '55');
    g.addColorStop(1, color + '00');
    return g;
  }

  const Charts = {
    // Linha: evolucao do patrimonio.
    line(canvasId, labels, values, { color = GOLD } = {}) {
      applyDefaults();
      destroy(canvasId);
      const el = document.getElementById(canvasId);
      if (!el) return;
      instances[canvasId] = new Chart(el, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: values,
            borderColor: color,
            borderWidth: 2,
            tension: 0.32,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: color,
            fill: true,
            backgroundColor: (c) => {
              const { ctx, chartArea } = c.chart;
              if (!chartArea) return color + '22';
              return goldGradient(ctx, chartArea, color);
            },
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#161616', borderColor: '#262626', borderWidth: 1,
              padding: 12, displayColors: false,
              callbacks: { label: (c) => brl(c.parsed.y) },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } },
            y: { grid: { color: GRID }, ticks: { callback: (v) => 'R$ ' + (v / 1000).toFixed(0) + 'k' } },
          },
        },
      });
    },

    // Linha multi-serie (ex: performance da moeda + preco medio) — em USD.
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
            {
              label: 'Preco', data: priceSeries, borderColor: GOLD, borderWidth: 2,
              tension: 0.3, pointRadius: 0, pointHoverRadius: 5, fill: true,
              backgroundColor: (c) => {
                const { ctx, chartArea } = c.chart;
                if (!chartArea) return GOLD + '22';
                return goldGradient(ctx, chartArea);
              },
            },
            {
              label: 'Preco medio', data: avgLine, borderColor: POSITIVE,
              borderWidth: 1.5, borderDash: [5, 5], pointRadius: 0, fill: false,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: true, position: 'top', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
            tooltip: {
              backgroundColor: '#161616', borderColor: '#262626', borderWidth: 1, padding: 12,
              callbacks: { label: (c) => `${c.dataset.label}: ${usd(c.parsed.y)}` },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } },
            y: { grid: { color: GRID }, ticks: { callback: (v) => usd(v) } },
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
            borderColor: '#0A0A0A', borderWidth: 3, hoverOffset: 6,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#161616', borderColor: '#262626', borderWidth: 1, padding: 12,
              callbacks: { label: (c) => `${c.label}: ${brl(c.parsed)}` },
            },
          },
        },
      });
    },

    // Barras: comparativo (cripto vs renda fixa).
    bars(canvasId, labels, values, colors) {
      applyDefaults();
      destroy(canvasId);
      const el = document.getElementById(canvasId);
      if (!el) return;
      instances[canvasId] = new Chart(el, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ data: values, backgroundColor: colors || PALETTE, borderRadius: 6, maxBarThickness: 60 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#161616', borderColor: '#262626', borderWidth: 1, padding: 12, displayColors: false,
              callbacks: { label: (c) => brl(c.parsed.y) },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: GRID }, ticks: { callback: (v) => 'R$ ' + (v / 1000).toFixed(0) + 'k' } },
          },
        },
      });
    },

    PALETTE,
  };

  window.Charts = Charts;
})();
