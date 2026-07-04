// Repository de usuarios.
import { db } from '../db/index.js';

export const usersRepo = {
  create({ email, passwordHash, name }) {
    const stmt = db.prepare(
      `INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`
    );
    const info = stmt.run(email, passwordHash, name || null);
    return this.findById(info.lastInsertRowid);
  },

  findByEmail(email) {
    return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  },

  findById(id) {
    return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
  },
};
