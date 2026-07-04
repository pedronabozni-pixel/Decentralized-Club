// Repository do historico de precos (usado no grafico de evolucao).
import { db } from '../db/index.js';

export const priceHistoryRepo = {
  record(symbol, price) {
    db.prepare(`INSERT INTO price_history (crypto_symbol, price) VALUES (?, ?)`)
      .run(symbol, price);
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
