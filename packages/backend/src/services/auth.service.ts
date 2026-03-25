import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database.js';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { User, AuthResponse, UserRole } from '@planning/shared';
import type { AuthPayload } from '../middleware/auth.js';

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    createdAt: row.created_at,
  };
}

export class AuthService {
  login(email: string, password: string): AuthResponse {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;

    if (!row) {
      throw new AppError(401, 'Email ou mot de passe incorrect');
    }

    const valid = bcrypt.compareSync(password, row.password_hash);
    if (!valid) {
      throw new AppError(401, 'Email ou mot de passe incorrect');
    }

    const payload: AuthPayload = {
      userId: row.id,
      email: row.email,
      role: row.role as UserRole,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    return { token, user: toUser(row) };
  }

  createUser(data: { email: string; password: string; name: string; role: UserRole }): User {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (existing) {
      throw new AppError(409, 'Un utilisateur avec cet email existe déjà');
    }

    const passwordHash = bcrypt.hashSync(data.password, 12);
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    ).run(data.email, passwordHash, data.name, data.role);

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as UserRow;
    return toUser(row);
  }

  getUsers(): User[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM users ORDER BY name').all() as UserRow[];
    return rows.map(toUser);
  }

  updateUser(id: number, data: { email?: string; password?: string; name?: string; role?: UserRole }): User {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    if (!existing) {
      throw new AppError(404, 'Utilisateur non trouvé');
    }

    if (data.email && data.email !== existing.email) {
      const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(data.email, id);
      if (dup) throw new AppError(409, 'Cet email est déjà utilisé');
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (data.email) { updates.push('email = ?'); values.push(data.email); }
    if (data.name) { updates.push('name = ?'); values.push(data.name); }
    if (data.role) { updates.push('role = ?'); values.push(data.role); }
    if (data.password) {
      updates.push('password_hash = ?');
      values.push(bcrypt.hashSync(data.password, 12));
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
    return toUser(row);
  }

  deleteUser(id: number): void {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (result.changes === 0) throw new AppError(404, 'Utilisateur non trouvé');
  }

  ensureAdminExists(): void {
    const db = getDatabase();
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (!admin) {
      this.createUser({
        email: 'admin@planning.local',
        password: 'admin123',
        name: 'Administrateur',
        role: 'admin',
      });
    }
  }
}

export const authService = new AuthService();
