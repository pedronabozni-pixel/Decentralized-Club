// Repository de metas financeiras.
import { db } from '../db/index.js';

export const goalsRepo = {
  create({ userId, name, targetAmount, targetDate, expectedRate, initialAmount, notes }) {
    const stmt = db.prepare(`
      INSERT INTO goals (user_id, name, target_amount, target_date, expected_rate, initial_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      userId, name, targetAmount, targetDate,
      expectedRate ?? 10, initialAmount ?? 0, notes || null
    );
    return this.findById(userId, info.lastInsertRowid);
  },

  findById(userId, id) {
    return db.prepare(`SELECT * FROM goals WHERE id = ? AND user_id = ?`).get(id, userId);
  },

  listByUser(userId) {
    return db
      .prepare(`SELECT * FROM goals WHERE user_id = ? ORDER BY target_date ASC`)
      .all(userId);
  },

  updateProgress(userId, id, initialAmount) {
    const info = db
      .prepare(`UPDATE goals SET initial_amount = ? WHERE id = ? AND user_id = ?`)
      .run(initialAmount, id, userId);
    return info.changes > 0;
  },

  remove(userId, id) {
    const info = db.prepare(`DELETE FROM goals WHERE id = ? AND user_id = ?`).run(id, userId);
    return info.changes > 0;
  },
};
