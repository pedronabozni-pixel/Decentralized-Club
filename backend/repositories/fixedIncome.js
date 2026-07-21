// Repository de renda fixa.
import { db } from '../db/index.js';

export const fixedIncomeRepo = {
  create({ userId, type, description, amount, rate, dateInvested, maturityDate, bank }) {
    const stmt = db.prepare(`
      INSERT INTO fixed_income
        (user_id, type, description, amount, rate, date_invested, maturity_date, bank)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      userId, type, description || null, amount, rate,
      dateInvested, maturityDate || null, bank || null
    );
    return this.findById(userId, info.lastInsertRowid);
  },

  findById(userId, id) {
    return db
      .prepare(`SELECT * FROM fixed_income WHERE id = ? AND user_id = ?`)
      .get(id, userId);
  },

  listByUser(userId) {
    return db
      .prepare(`SELECT * FROM fixed_income WHERE user_id = ? ORDER BY date_invested DESC, id DESC`)
      .all(userId);
  },

  update(userId, id, { type, description, amount, rate, dateInvested, maturityDate, bank }) {
    const info = db
      .prepare(`
        UPDATE fixed_income SET
          type = ?, description = ?, amount = ?, rate = ?,
          date_invested = ?, maturity_date = ?, bank = ?
        WHERE id = ? AND user_id = ?
      `)
      .run(
        type, description || null, amount, rate,
        dateInvested, maturityDate || null, bank || null,
        id, userId
      );
    return info.changes > 0 ? this.findById(userId, id) : null;
  },

  remove(userId, id) {
    const info = db
      .prepare(`DELETE FROM fixed_income WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    return info.changes > 0;
  },
};
