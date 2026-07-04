// Repository de compras de cripto.
import { db } from '../db/index.js';

export const cryptoBuysRepo = {
  create({ userId, symbol, name, quantity, pricePerUnit, dateBought }) {
    const totalSpent = quantity * pricePerUnit;
    const stmt = db.prepare(`
      INSERT INTO crypto_buys
        (user_id, crypto_symbol, crypto_name, quantity, price_per_unit, total_spent, date_bought)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      userId, symbol, name || null, quantity, pricePerUnit, totalSpent, dateBought
    );
    return this.findById(userId, info.lastInsertRowid);
  },

  findById(userId, id) {
    return db
      .prepare(`SELECT * FROM crypto_buys WHERE id = ? AND user_id = ?`)
      .get(id, userId);
  },

  // Todas as compras do usuario (mais recentes primeiro).
  listByUser(userId) {
    return db
      .prepare(`SELECT * FROM crypto_buys WHERE user_id = ? ORDER BY date_bought DESC, id DESC`)
      .all(userId);
  },

  // Compras de uma moeda especifica.
  listBySymbol(userId, symbol) {
    return db
      .prepare(`
        SELECT * FROM crypto_buys
        WHERE user_id = ? AND crypto_symbol = ?
        ORDER BY date_bought DESC, id DESC
      `)
      .all(userId, symbol);
  },

  remove(userId, id) {
    const info = db
      .prepare(`DELETE FROM crypto_buys WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    return info.changes > 0;
  },

  // Agrega posicao por moeda: quantidade total e custo total -> base p/ preco medio.
  positions(userId) {
    return db
      .prepare(`
        SELECT
          crypto_symbol AS symbol,
          MAX(crypto_name) AS name,
          SUM(quantity)    AS total_quantity,
          SUM(total_spent) AS total_spent,
          COUNT(*)         AS buy_count
        FROM crypto_buys
        WHERE user_id = ?
        GROUP BY crypto_symbol
        HAVING SUM(quantity) > 0
        ORDER BY total_spent DESC
      `)
      .all(userId);
  },
};
