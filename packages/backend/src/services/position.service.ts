import { getDatabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Position, PositionWithRequirements, PositionSkillRequirement, SkillLevel } from '@planning/shared';

interface PositionRow {
  id: number; name: string; description: string; color: string;
  default_headcount: number; created_at: string; updated_at: string;
}

interface RequirementRow {
  id: number; position_id: number; skill_id: number;
  minimum_level: number; is_required: number; skill_name?: string;
}

function toPosition(row: PositionRow): Position {
  return {
    id: row.id, name: row.name, description: row.description,
    color: row.color, defaultHeadcount: row.default_headcount,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function toRequirement(row: RequirementRow): PositionSkillRequirement {
  return {
    id: row.id, positionId: row.position_id, skillId: row.skill_id,
    minimumLevel: row.minimum_level as SkillLevel, isRequired: row.is_required === 1,
    skillName: row.skill_name,
  };
}

export class PositionService {
  getAll(): Position[] {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM positions ORDER BY name').all() as PositionRow[]).map(toPosition);
  }

  getById(id: number): Position {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM positions WHERE id = ?').get(id) as PositionRow | undefined;
    if (!row) throw new AppError(404, 'Poste non trouvé');
    return toPosition(row);
  }

  getWithRequirements(id: number): PositionWithRequirements {
    const position = this.getById(id);
    const db = getDatabase();
    const reqs = db.prepare(`
      SELECT psr.*, s.name as skill_name
      FROM position_skill_requirements psr
      JOIN skills s ON s.id = psr.skill_id
      WHERE psr.position_id = ?
      ORDER BY psr.is_required DESC, s.name
    `).all(id) as RequirementRow[];

    return { ...position, skillRequirements: reqs.map(toRequirement) };
  }

  getAllWithRequirements(): PositionWithRequirements[] {
    return this.getAll().map((p) => this.getWithRequirements(p.id));
  }

  create(data: {
    name: string; description?: string; color?: string; defaultHeadcount?: number;
    skillRequirements?: { skillId: number; minimumLevel: number; isRequired: boolean }[];
  }): PositionWithRequirements {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM positions WHERE name = ?').get(data.name);
    if (existing) throw new AppError(409, 'Un poste avec ce nom existe déjà');

    const result = db.prepare(`
      INSERT INTO positions (name, description, color, default_headcount) VALUES (?, ?, ?, ?)
    `).run(data.name, data.description || '', data.color || '#3B82F6', data.defaultHeadcount || 1);

    const positionId = Number(result.lastInsertRowid);

    if (data.skillRequirements && data.skillRequirements.length > 0) {
      const insert = db.prepare(
        'INSERT INTO position_skill_requirements (position_id, skill_id, minimum_level, is_required) VALUES (?, ?, ?, ?)',
      );
      for (const req of data.skillRequirements) {
        insert.run(positionId, req.skillId, req.minimumLevel, req.isRequired ? 1 : 0);
      }
    }

    return this.getWithRequirements(positionId);
  }

  update(id: number, data: Partial<{
    name: string; description: string; color: string; defaultHeadcount: number;
    skillRequirements: { skillId: number; minimumLevel: number; isRequired: boolean }[];
  }>): PositionWithRequirements {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM positions WHERE id = ?').get(id) as PositionRow | undefined;
    if (!existing) throw new AppError(404, 'Poste non trouvé');

    if (data.name && data.name !== existing.name) {
      const dup = db.prepare('SELECT id FROM positions WHERE name = ? AND id != ?').get(data.name, id);
      if (dup) throw new AppError(409, 'Un poste avec ce nom existe déjà');
    }

    const fieldMap: Record<string, string> = {
      name: 'name', description: 'description', color: 'color', defaultHeadcount: 'default_headcount',
    };

    const updates: string[] = [];
    const values: (string | number)[] = [];

    for (const [key, col] of Object.entries(fieldMap)) {
      const val = data[key as keyof typeof data];
      if (val !== undefined && typeof val !== 'object') {
        updates.push(`${col} = ?`); values.push(val as string | number);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE positions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    if (data.skillRequirements !== undefined) {
      db.prepare('DELETE FROM position_skill_requirements WHERE position_id = ?').run(id);
      const insert = db.prepare(
        'INSERT INTO position_skill_requirements (position_id, skill_id, minimum_level, is_required) VALUES (?, ?, ?, ?)',
      );
      for (const req of data.skillRequirements) {
        insert.run(id, req.skillId, req.minimumLevel, req.isRequired ? 1 : 0);
      }
    }

    return this.getWithRequirements(id);
  }

  delete(id: number): void {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM positions WHERE id = ?').run(id);
    if (result.changes === 0) throw new AppError(404, 'Poste non trouvé');
  }
}

export const positionService = new PositionService();
