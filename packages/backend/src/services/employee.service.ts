import { getDatabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  Employee, EmployeeWithDetails, EmployeeSkillRating, EmployeePositionPreference,
  WorkLimits, ContractType, EmployeeStatus, SkillLevel, SkillCategory,
} from '@planning/shared';

interface EmployeeRow {
  id: number; first_name: string; last_name: string; email: string; phone: string;
  hire_date: string; contract_type: string; status: string; photo: string;
  created_at: string; updated_at: string;
}

interface SkillRatingRow {
  id: number; employee_id: number; skill_id: number; rating: number;
  skill_name?: string; skill_category?: string;
}

interface PositionPrefRow {
  id: number; employee_id: number; position_id: number; rank: number;
  position_name?: string;
}

interface WorkLimitsRow {
  id: number; employee_id: number; max_hours_per_day: number | null;
  max_hours_per_week: number | null; max_hours_per_month: number | null;
}

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id, firstName: row.first_name, lastName: row.last_name,
    email: row.email, phone: row.phone, hireDate: row.hire_date,
    contractType: row.contract_type as ContractType, status: row.status as EmployeeStatus,
    photo: row.photo, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function toSkillRating(row: SkillRatingRow): EmployeeSkillRating {
  return {
    id: row.id, employeeId: row.employee_id, skillId: row.skill_id,
    rating: row.rating as SkillLevel, skillName: row.skill_name,
    skillCategory: row.skill_category as SkillCategory | undefined,
  };
}

function toPositionPref(row: PositionPrefRow): EmployeePositionPreference {
  return {
    id: row.id, employeeId: row.employee_id, positionId: row.position_id,
    rank: row.rank, positionName: row.position_name,
  };
}

function toWorkLimits(row: WorkLimitsRow): WorkLimits {
  return {
    id: row.id, employeeId: row.employee_id,
    maxHoursPerDay: row.max_hours_per_day, maxHoursPerWeek: row.max_hours_per_week,
    maxHoursPerMonth: row.max_hours_per_month,
  };
}

export class EmployeeService {
  getAll(status?: EmployeeStatus): Employee[] {
    const db = getDatabase();
    let query = 'SELECT * FROM employees';
    const params: string[] = [];
    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY last_name, first_name';
    return (db.prepare(query).all(...params) as EmployeeRow[]).map(toEmployee);
  }

  getById(id: number): Employee {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as EmployeeRow | undefined;
    if (!row) throw new AppError(404, 'Employé non trouvé');
    return toEmployee(row);
  }

  getWithDetails(id: number): EmployeeWithDetails {
    const employee = this.getById(id);
    const db = getDatabase();

    const ratings = db.prepare(`
      SELECT esr.*, s.name as skill_name, s.category as skill_category
      FROM employee_skill_ratings esr
      JOIN skills s ON s.id = esr.skill_id
      WHERE esr.employee_id = ?
      ORDER BY s.category, s.name
    `).all(id) as SkillRatingRow[];

    const prefs = db.prepare(`
      SELECT epp.*, p.name as position_name
      FROM employee_position_preferences epp
      JOIN positions p ON p.id = epp.position_id
      WHERE epp.employee_id = ?
      ORDER BY epp.rank
    `).all(id) as PositionPrefRow[];

    const limitsRow = db.prepare('SELECT * FROM work_limits WHERE employee_id = ?').get(id) as WorkLimitsRow | undefined;

    return {
      ...employee,
      skillRatings: ratings.map(toSkillRating),
      positionPreferences: prefs.map(toPositionPref),
      workLimits: limitsRow ? toWorkLimits(limitsRow) : null,
    };
  }

  getAllWithDetails(): EmployeeWithDetails[] {
    const employees = this.getAll();
    return employees.map((e) => this.getWithDetails(e.id));
  }

  create(data: {
    firstName: string; lastName: string; email: string; phone?: string;
    hireDate: string; contractType: ContractType; status?: EmployeeStatus; photo?: string;
  }): Employee {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM employees WHERE email = ?').get(data.email);
    if (existing) throw new AppError(409, 'Un employé avec cet email existe déjà');

    const result = db.prepare(`
      INSERT INTO employees (first_name, last_name, email, phone, hire_date, contract_type, status, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.firstName, data.lastName, data.email, data.phone || '',
      data.hireDate, data.contractType, data.status || 'actif', data.photo || '',
    );

    return this.getById(Number(result.lastInsertRowid));
  }

  update(id: number, data: Partial<{
    firstName: string; lastName: string; email: string; phone: string;
    hireDate: string; contractType: ContractType; status: EmployeeStatus; photo: string;
  }>): Employee {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as EmployeeRow | undefined;
    if (!existing) throw new AppError(404, 'Employé non trouvé');

    if (data.email && data.email !== existing.email) {
      const dup = db.prepare('SELECT id FROM employees WHERE email = ? AND id != ?').get(data.email, id);
      if (dup) throw new AppError(409, 'Cet email est déjà utilisé');
    }

    const fieldMap: Record<string, string> = {
      firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone',
      hireDate: 'hire_date', contractType: 'contract_type', status: 'status', photo: 'photo',
    };

    const updates: string[] = [];
    const values: (string | number)[] = [];

    for (const [key, col] of Object.entries(fieldMap)) {
      const val = data[key as keyof typeof data];
      if (val !== undefined) { updates.push(`${col} = ?`); values.push(val); }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getById(id);
  }

  delete(id: number): void {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    if (result.changes === 0) throw new AppError(404, 'Employé non trouvé');
  }

  setSkillRatings(employeeId: number, ratings: { skillId: number; rating: number }[]): EmployeeSkillRating[] {
    const db = getDatabase();
    this.getById(employeeId);

    const upsert = db.transaction(() => {
      db.prepare('DELETE FROM employee_skill_ratings WHERE employee_id = ?').run(employeeId);
      const insert = db.prepare(
        'INSERT INTO employee_skill_ratings (employee_id, skill_id, rating) VALUES (?, ?, ?)',
      );
      for (const r of ratings) {
        insert.run(employeeId, r.skillId, r.rating);
      }
    });
    upsert();

    const rows = db.prepare(`
      SELECT esr.*, s.name as skill_name, s.category as skill_category
      FROM employee_skill_ratings esr
      JOIN skills s ON s.id = esr.skill_id
      WHERE esr.employee_id = ?
    `).all(employeeId) as SkillRatingRow[];

    return rows.map(toSkillRating);
  }

  setPositionPreferences(employeeId: number, preferences: { positionId: number; rank: number }[]): EmployeePositionPreference[] {
    const db = getDatabase();
    this.getById(employeeId);

    const upsert = db.transaction(() => {
      db.prepare('DELETE FROM employee_position_preferences WHERE employee_id = ?').run(employeeId);
      const insert = db.prepare(
        'INSERT INTO employee_position_preferences (employee_id, position_id, rank) VALUES (?, ?, ?)',
      );
      for (const p of preferences) {
        insert.run(employeeId, p.positionId, p.rank);
      }
    });
    upsert();

    const rows = db.prepare(`
      SELECT epp.*, p.name as position_name
      FROM employee_position_preferences epp
      JOIN positions p ON p.id = epp.position_id
      WHERE epp.employee_id = ?
      ORDER BY epp.rank
    `).all(employeeId) as PositionPrefRow[];

    return rows.map(toPositionPref);
  }

  setWorkLimits(employeeId: number, limits: { maxHoursPerDay?: number; maxHoursPerWeek?: number; maxHoursPerMonth?: number }): WorkLimits {
    const db = getDatabase();
    this.getById(employeeId);

    const existing = db.prepare('SELECT * FROM work_limits WHERE employee_id = ?').get(employeeId);

    if (existing) {
      db.prepare(`
        UPDATE work_limits SET max_hours_per_day = ?, max_hours_per_week = ?, max_hours_per_month = ?
        WHERE employee_id = ?
      `).run(limits.maxHoursPerDay ?? null, limits.maxHoursPerWeek ?? null, limits.maxHoursPerMonth ?? null, employeeId);
    } else {
      db.prepare(`
        INSERT INTO work_limits (employee_id, max_hours_per_day, max_hours_per_week, max_hours_per_month)
        VALUES (?, ?, ?, ?)
      `).run(employeeId, limits.maxHoursPerDay ?? null, limits.maxHoursPerWeek ?? null, limits.maxHoursPerMonth ?? null);
    }

    const row = db.prepare('SELECT * FROM work_limits WHERE employee_id = ?').get(employeeId) as WorkLimitsRow;
    return toWorkLimits(row);
  }
}

export const employeeService = new EmployeeService();
