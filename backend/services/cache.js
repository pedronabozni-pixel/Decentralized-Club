// ==========================================================================
//  Cache em memoria com TTL (substitui o Redis na Fase 1 — sem instalacao).
//  Interface simples get/set/getOrSet. Na Fase 4 pode-se trocar por Redis
//  mantendo a mesma assinatura.
// ==========================================================================
const store = new Map(); // key -> { value, expiresAt }

export const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  },

  set(key, value, ttlSeconds) {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return value;
  },

  /**
   * Retorna do cache ou executa `producer()` (async), guardando o resultado.
   * Evita chamadas duplicadas as APIs externas.
   */
  async getOrSet(key, ttlSeconds, producer) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await producer();
    return this.set(key, value, ttlSeconds);
  },
};
