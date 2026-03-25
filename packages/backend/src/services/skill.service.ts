import { getDatabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Skill, SkillCategory } from '@planning/shared';

interface SkillRow {
  id: number;
  name: string;
  description: string;
  category: string;
  created_at: string;
  updated_at: string;
}

function toSkill(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category as SkillCategory,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SkillService {
  getAll(): Skill[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM skills ORDER BY category, name').all() as SkillRow[];
    return rows.map(toSkill);
  }

  getById(id: number): Skill {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | undefined;
    if (!row) throw new AppError(404, 'Compétence non trouvée');
    return toSkill(row);
  }

  create(data: { name: string; description?: string; category: SkillCategory }): Skill {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM skills WHERE name = ?').get(data.name);
    if (existing) throw new AppError(409, 'Une compétence avec ce nom existe déjà');

    const result = db.prepare(
      'INSERT INTO skills (name, description, category) VALUES (?, ?, ?)',
    ).run(data.name, data.description || '', data.category);

    return this.getById(Number(result.lastInsertRowid));
  }

  update(id: number, data: { name?: string; description?: string; category?: SkillCategory }): Skill {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | undefined;
    if (!existing) throw new AppError(404, 'Compétence non trouvée');

    if (data.name && data.name !== existing.name) {
      const dup = db.prepare('SELECT id FROM skills WHERE name = ? AND id != ?').get(data.name, id);
      if (dup) throw new AppError(409, 'Une compétence avec ce nom existe déjà');
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.category !== undefined) { updates.push('category = ?'); values.push(data.category); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getById(id);
  }

  delete(id: number): void {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    if (result.changes === 0) throw new AppError(404, 'Compétence non trouvée');
  }

  getByCategory(category: SkillCategory): Skill[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM skills WHERE category = ? ORDER BY name').all(category) as SkillRow[];
    return rows.map(toSkill);
  }
}

export const skillService = new SkillService();
