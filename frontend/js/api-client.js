// ==========================================================================
//  Cliente HTTP da API. Anexa o token JWT, trata erros e redireciona ao login
//  quando a sessao expira. Exposto como window.API.
// ==========================================================================
(function () {
  const TOKEN_KEY = 'dc_token';
  const USER_KEY = 'dc_user';

  const Auth = {
    get token() { return localStorage.getItem(TOKEN_KEY); },
    get user() {
      try { return JSON.parse(localStorage.getItem(USER_KEY)); }
      catch { return null; }
    },
    set(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    get isAuthed() { return !!this.token; },
  };

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;

    let res;
    try {
      res = await fetch(`/api${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError('Falha de conexao com o servidor.', 0);
    }

    if (res.status === 401 && !path.startsWith('/auth')) {
      Auth.clear();
      window.location.href = '/index.html';
      throw new ApiError('Sessao expirada.', 401);
    }

    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }

    if (!res.ok) {
      throw new ApiError(data?.error || `Erro ${res.status}`, res.status, data?.details);
    }
    return data;
  }

  class ApiError extends Error {
    constructor(message, status, details) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }

  window.API = {
    Auth,
    ApiError,
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b),
    del: (p) => request('DELETE', p),

    // Atalhos de dominio
    login: (email, password) => request('POST', '/auth/login', { email, password }),
    register: (payload) => request('POST', '/auth/register', payload),
    portfolio: () => request('GET', '/portfolio/summary'),
    portfolioEvolution: (days) => request('GET', `/portfolio/evolution?days=${days || 30}`),
    cryptoPositions: () => request('GET', '/crypto/positions'),
    cryptoBuys: () => request('GET', '/crypto/buys'),
    cryptoBuysBySymbol: (s) => request('GET', `/crypto/buys/${encodeURIComponent(s)}`),
    addCryptoBuy: (b) => request('POST', '/crypto/buys', b),
    updateCryptoBuy: (id, b) => request('PUT', `/crypto/buys/${id}`, b),
    deleteCryptoBuy: (id) => request('DELETE', `/crypto/buys/${id}`),
    searchCoins: (q) => request('GET', `/crypto/search?q=${encodeURIComponent(q)}`),
    fixedIncome: () => request('GET', '/fixed-income'),
    addFixedIncome: (i) => request('POST', '/fixed-income', i),
    updateFixedIncome: (id, i) => request('PUT', `/fixed-income/${id}`, i),
    deleteFixedIncome: (id) => request('DELETE', `/fixed-income/${id}`),
    simulate: (p) => request('POST', '/fixed-income/simulate', p),
    selic: () => request('GET', '/fixed-income/selic'),
    priceHistory: (s, days) => request('GET', `/market/history/${encodeURIComponent(s)}?days=${days}`),
    assets: () => request('GET', '/assets'),
    assetCategories: () => request('GET', '/assets/categories'),
    addAsset: (a) => request('POST', '/assets', a),
    updateAsset: (id, a) => request('PUT', `/assets/${id}`, a),
    updateAssetValue: (id, currentValue) => request('PATCH', `/assets/${id}/value`, { currentValue }),
    deleteAsset: (id) => request('DELETE', `/assets/${id}`),
    goals: () => request('GET', '/goals'),
    addGoal: (g) => request('POST', '/goals', g),
    updateGoalProgress: (id, initialAmount) => request('PATCH', `/goals/${id}/progress`, { initialAmount }),
    deleteGoal: (id) => request('DELETE', `/goals/${id}`),
  };
})();
