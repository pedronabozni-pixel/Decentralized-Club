// Repository de outros ativos (bolsa, fundos, fisicos...).
import { db } from '../db/index.js';

export const assetsRepo = {
  create({ userId, category, name, ticker, quantity, invested, currentValue, purchaseDate, notes }) {
    const stmt = db.prepare(`
      INSERT INTO assets
        (user_id, category, name, ticker, quantity, invested, current_value, purchase_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      userId, category, name, ticker || null, quantity ?? null,
      invested, currentValue ?? null, purchaseDate || null, notes || null
    );
    return this.findById(userId, info.lastInsertRowid);
  },

  findById(userId, id) {
    return db.prepare(`SELECT * FROM assets WHERE id = ? AND user_id = ?`).get(id, userId);
  },

  listByUser(userId) {
    return db
      .prepare(`SELECT * FROM assets WHERE user_id = ? ORDER BY category, name`)
      .all(userId);
  },

  update(userId, id, { category, name, ticker, quantity, invested, currentValue, purchaseDate, notes }) {
    const info = db
      .prepare(`
        UPDATE assets SET
          category = ?, name = ?, ticker = ?, quantity = ?,
          invested = ?, current_value = ?, purchase_date = ?, notes = ?
        WHERE id = ? AND user_id = ?
      `)
      .run(
        category, name, ticker || null, quantity ?? null,
        invested, currentValue ?? null, purchaseDate || null, notes || null,
        id, userId
      );
    return info.changes > 0 ? this.findById(userId, id) : null;
  },

  updateCurrentValue(userId, id, currentValue) {
    const info = db
      .prepare(`UPDATE assets SET current_value = ? WHERE id = ? AND user_id = ?`)
      .run(currentValue, id, userId);
    return info.changes > 0;
  },

  remove(userId, id) {
    const info = db.prepare(`DELETE FROM assets WHERE id = ? AND user_id = ?`).run(id, userId);
    return info.changes > 0;
  },
};
