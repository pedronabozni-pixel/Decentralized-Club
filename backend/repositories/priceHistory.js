// Repository do historico de precos (usado no grafico de evolucao).
import { db } from '../db/index.js';

export const priceHistoryRepo = {
  record(symbol, price) {
    db.prepare(`INSERT INTO price_history (crypto_symbol, price) VALUES (?, ?)`)
      .run(symbol, price);
  },

  /**
   * Grava no maximo 1 registro por simbolo a cada `minMinutes` — evita
   * inflar a tabela a cada refresh do dashboard.
   */
  recordThrottled(symbol, price, minMinutes = 60) {
    const last = db
      .prepare(`
        SELECT date FROM price_history
        WHERE crypto_symbol = ? AND date >= datetime('now', ?)
        LIMIT 1
      `)
      .get(symbol, `-${minMinutes} minutes`);
    if (!last) this.record(symbol, price);
  },

  // Ultimos N dias de um simbolo.
  recent(symbol, days = 30) {
    return db
      .prepare(`
        SELECT price, date FROM price_history
        WHERE crypto_symbol = ? AND date >= datetime('now', ?)
        ORDER BY date ASC
      `)
      .all(symbol, `-${days} days`);
  },
};
