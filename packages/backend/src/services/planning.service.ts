import { getDatabase } from '../config/database.js';
import { backupDatabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { PlanningOptimizer } from '../optimizer/index.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import type {
  Planning, PlanningWithDetails, SlotRequirement, Assignment,
  PlanningAlert, PlanningQualityReport,
} from '@planning/shared';

interface PlanningRow {
  id: number; start_date: string; end_date: string; status: string;
  quality_score: number | null; coverage_score: number | null;
  adequacy_score: number | null; equity_score: number | null;
  seed: number; created_at: string; updated_at: string;
}

interface SlotRow {
  id: number; planning_id: number; position_id: number; date: string;
  start_time: string; end_time: string; headcount: number;
  position_name?: string; position_color?: string;
}

interface AssignmentRow {
  id: number; planning_id: number; slot_requirement_id: number; employee_id: number;
  is_manual: number; is_forced: number; warnings: string; created_at: string;
  employee_name?: string; position_name?: string; position_color?: string;
  date?: string; start_time?: string; end_time?: string;
}

function toPlanning(row: PlanningRow): Planning {
  return {
    id: row.id, startDate: row.start_date, endDate: row.end_date,
    status: row.status as Planning['status'],
    qualityScore: row.quality_score, coverageScore: row.coverage_score,
    adequacyScore: row.adequacy_score, equityScore: row.equity_score,
    seed: row.seed, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function toSlotRequirement(row: SlotRow): SlotRequirement {
  return {
    id: row.id, planningId: row.planning_id, positionId: row.position_id,
    date: row.date, startTime: row.start_time, endTime: row.end_time,
    headcount: row.headcount, positionName: row.position_name,
    positionColor: row.position_color,
  };
}

function toAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id, planningId: row.planning_id, slotRequirementId: row.slot_requirement_id,
    employeeId: row.employee_id, isManual: row.is_manual === 1,
    isForced: row.is_forced === 1, warnings: JSON.parse(row.warnings),
    employeeName: row.employee_name, positionName: row.position_name,
    positionColor: row.position_color, date: row.date,
    startTime: row.start_time, endTime: row.end_time,
  };
}

export class PlanningService {
  getAll(): Planning[] {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM plannings ORDER BY created_at DESC').all() as PlanningRow[]).map(toPlanning);
  }

  getById(id: number): Planning {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM plannings WHERE id = ?').get(id) as PlanningRow | undefined;
    if (!row) throw new AppError(404, 'Planning non trouve');
    return toPlanning(row);
  }

  getWithDetails(id: number): PlanningWithDetails {
    const planning = this.getById(id);
    const db = getDatabase();

    const slots = db.prepare(`
      SELECT sr.*, p.name as position_name, p.color as position_color
      FROM slot_requirements sr
      JOIN positions p ON p.id = sr.position_id
      WHERE sr.planning_id = ?
      ORDER BY sr.date, sr.start_time
    `).all(id) as SlotRow[];

    const assignments = db.prepare(`
      SELECT a.*,
        e.first_name || ' ' || e.last_name as employee_name,
        p.name as position_name, p.color as position_color,
        sr.date, sr.start_time, sr.end_time
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
      JOIN slot_requirements sr ON sr.id = a.slot_requirement_id
      JOIN positions p ON p.id = sr.position_id
      WHERE a.planning_id = ?
      ORDER BY sr.date, sr.start_time, e.last_name
    `).all(id) as AssignmentRow[];

    return {
      ...planning,
      requirements: slots.map(toSlotRequirement),
      assignments: assignments.map(toAssignment),
      alerts: [],
    };
  }

  create(data: {
    startDate: string; endDate: string;
    requirements: { positionId: number; date: string; startTime: string; endTime: string; headcount: number }[];
    seed?: number;
  }): PlanningWithDetails {
    const db = getDatabase();

    if (new Date(data.startDate) > new Date(data.endDate)) {
      throw new AppError(400, 'La date de debut doit etre anterieure a la date de fin');
    }

    const seed = data.seed ?? config.optimizer.seed;

    const result = db.prepare(`
      INSERT INTO plannings (start_date, end_date, status, seed) VALUES (?, ?, 'draft', ?)
    `).run(data.startDate, data.endDate, seed);

    const planningId = Number(result.lastInsertRowid);

    const insertSlot = db.prepare(`
      INSERT INTO slot_requirements (planning_id, position_id, date, start_time, end_time, headcount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertAll = db.transaction(() => {
      for (const req of data.requirements) {
        insertSlot.run(planningId, req.positionId, req.date, req.startTime, req.endTime, req.headcount);
      }
    });
    insertAll();

    return this.getWithDetails(planningId);
  }

  update(id: number, data: { startDate?: string; endDate?: string; seed?: number }): Planning {
    const db = getDatabase();
    this.getById(id);

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (data.startDate !== undefined) { updates.push('start_date = ?'); values.push(data.startDate); }
    if (data.endDate !== undefined) { updates.push('end_date = ?'); values.push(data.endDate); }
    if (data.seed !== undefined) { updates.push('seed = ?'); values.push(data.seed); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE plannings SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getById(id);
  }

  addRequirement(planningId: number, data: {
    positionId: number; date: string; startTime: string; endTime: string; headcount: number;
  }): SlotRequirement {
    const db = getDatabase();
    this.getById(planningId);

    const result = db.prepare(`
      INSERT INTO slot_requirements (planning_id, position_id, date, start_time, end_time, headcount)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(planningId, data.positionId, data.date, data.startTime, data.endTime, data.headcount);

    const row = db.prepare(`
      SELECT sr.*, p.name as position_name, p.color as position_color
      FROM slot_requirements sr
      JOIN positions p ON p.id = sr.position_id
      WHERE sr.id = ?
    `).get(result.lastInsertRowid) as SlotRow;

    // Remettre le planning en brouillon
    db.prepare("UPDATE plannings SET status = 'draft', updated_at = datetime('now') WHERE id = ?").run(planningId);

    return toSlotRequirement(row);
  }

  addRequirements(planningId: number, requirements: {
    positionId: number; date: string; startTime: string; endTime: string; headcount: number;
  }[]): SlotRequirement[] {
    const db = getDatabase();
    this.getById(planningId);

    const insertSlot = db.prepare(`
      INSERT INTO slot_requirements (planning_id, position_id, date, start_time, end_time, headcount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const ids: number[] = [];
    const insertAll = db.transaction(() => {
      for (const req of requirements) {
        const result = insertSlot.run(planningId, req.positionId, req.date, req.startTime, req.endTime, req.headcount);
        ids.push(Number(result.lastInsertRowid));
      }
    });
    insertAll();

    db.prepare("UPDATE plannings SET status = 'draft', updated_at = datetime('now') WHERE id = ?").run(planningId);

    const slots = ids.map((slotId) => {
      const row = db.prepare(`
        SELECT sr.*, p.name as position_name, p.color as position_color
        FROM slot_requirements sr JOIN positions p ON p.id = sr.position_id
        WHERE sr.id = ?
      `).get(slotId) as SlotRow;
      return toSlotRequirement(row);
    });

    return slots;
  }

  updateRequirement(planningId: number, requirementId: number, data: {
    positionId?: number; date?: string; startTime?: string; endTime?: string; headcount?: number;
  }): SlotRequirement {
    const db = getDatabase();
    this.getById(planningId);

    const existing = db.prepare('SELECT * FROM slot_requirements WHERE id = ? AND planning_id = ?').get(requirementId, planningId);
    if (!existing) throw new AppError(404, 'Creneau non trouve');

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (data.positionId !== undefined) { updates.push('position_id = ?'); values.push(data.positionId); }
    if (data.date !== undefined) { updates.push('date = ?'); values.push(data.date); }
    if (data.startTime !== undefined) { updates.push('start_time = ?'); values.push(data.startTime); }
    if (data.endTime !== undefined) { updates.push('end_time = ?'); values.push(data.endTime); }
    if (data.headcount !== undefined) { updates.push('headcount = ?'); values.push(data.headcount); }

    if (updates.length > 0) {
      values.push(requirementId);
      db.prepare(`UPDATE slot_requirements SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    db.prepare("UPDATE plannings SET status = 'draft', updated_at = datetime('now') WHERE id = ?").run(planningId);

    const row = db.prepare(`
      SELECT sr.*, p.name as position_name, p.color as position_color
      FROM slot_requirements sr JOIN positions p ON p.id = sr.position_id
      WHERE sr.id = ?
    `).get(requirementId) as SlotRow;

    return toSlotRequirement(row);
  }

  removeRequirement(planningId: number, requirementId: number): void {
    const db = getDatabase();
    this.getById(planningId);

    // Supprimer les affectations liees
    db.prepare('DELETE FROM assignments WHERE slot_requirement_id = ? AND planning_id = ?').run(requirementId, planningId);

    const result = db.prepare('DELETE FROM slot_requirements WHERE id = ? AND planning_id = ?').run(requirementId, planningId);
    if (result.changes === 0) throw new AppError(404, 'Creneau non trouve');

    db.prepare("UPDATE plannings SET status = 'draft', updated_at = datetime('now') WHERE id = ?").run(planningId);
  }

  generate(id: number): { planning: PlanningWithDetails; report: PlanningQualityReport } {
    const db = getDatabase();
    const planning = this.getById(id);

    try { backupDatabase(); } catch (e) {
      logger.warn('Impossible de creer un backup avant generation', e);
    }

    db.prepare('DELETE FROM assignments WHERE planning_id = ? AND is_manual = 0').run(id);

    const optimizer = new PlanningOptimizer(planning.seed);
    const result = optimizer.generate(id);

    const insertAssignment = db.prepare(`
      INSERT INTO assignments (planning_id, slot_requirement_id, employee_id, is_manual, is_forced, warnings)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertAll = db.transaction(() => {
      for (const a of result.assignments) {
        insertAssignment.run(a.planningId, a.slotRequirementId, a.employeeId, 0, 0, JSON.stringify(a.warnings));
      }
    });
    insertAll();

    db.prepare(`
      UPDATE plannings SET
        status = 'generated',
        quality_score = ?, coverage_score = ?, adequacy_score = ?, equity_score = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(result.report.overallScore, result.report.coverageScore, result.report.adequacyScore, result.report.equityScore, id);

    return { planning: this.getWithDetails(id), report: result.report };
  }

  addManualAssignment(planningId: number, slotRequirementId: number, employeeId: number, force: boolean): Assignment {
    const db = getDatabase();
    this.getById(planningId);

    const optimizer = new PlanningOptimizer();
    const validation = optimizer.validateManualAssignment(planningId, slotRequirementId, employeeId);

    if (!validation.valid && !force) {
      throw new AppError(400, 'Affectation invalide : ' + validation.warnings.join('; ') + '. Utilisez force=true pour forcer.');
    }

    const existing = db.prepare(
      'SELECT id FROM assignments WHERE planning_id = ? AND slot_requirement_id = ? AND employee_id = ?',
    ).get(planningId, slotRequirementId, employeeId);
    if (existing) throw new AppError(409, 'Cet employe est deja affecte a ce creneau');

    const result = db.prepare(`
      INSERT INTO assignments (planning_id, slot_requirement_id, employee_id, is_manual, is_forced, warnings)
      VALUES (?, ?, ?, 1, ?, ?)
    `).run(planningId, slotRequirementId, employeeId, force ? 1 : 0, JSON.stringify(validation.warnings));

    const row = db.prepare(`
      SELECT a.*,
        e.first_name || ' ' || e.last_name as employee_name,
        p.name as position_name, p.color as position_color,
        sr.date, sr.start_time, sr.end_time
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
      JOIN slot_requirements sr ON sr.id = a.slot_requirement_id
      JOIN positions p ON p.id = sr.position_id
      WHERE a.id = ?
    `).get(result.lastInsertRowid) as AssignmentRow;

    return toAssignment(row);
  }

  removeAssignment(planningId: number, assignmentId: number): void {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM assignments WHERE id = ? AND planning_id = ?').run(assignmentId, planningId);
    if (result.changes === 0) throw new AppError(404, 'Affectation non trouvee');
  }

  publish(id: number): Planning {
    const db = getDatabase();
    const planning = this.getById(id);
    if (planning.status === 'draft') {
      throw new AppError(400, 'Le planning doit etre genere avant publication');
    }

    db.prepare("UPDATE plannings SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(id);
    return this.getById(id);
  }

  delete(id: number): void {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM plannings WHERE id = ?').run(id);
    if (result.changes === 0) throw new AppError(404, 'Planning non trouve');
  }

  getDashboardStats(): {
    totalEmployees: number; activeEmployees: number; totalPositions: number;
    totalSkills: number; activePlannings: number; recentAlerts: PlanningAlert[];
  } {
    const db = getDatabase();
    const totalEmployees = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c;
    const activeEmployees = (db.prepare("SELECT COUNT(*) as c FROM employees WHERE status = 'actif'").get() as any).c;
    const totalPositions = (db.prepare('SELECT COUNT(*) as c FROM positions').get() as any).c;
    const totalSkills = (db.prepare('SELECT COUNT(*) as c FROM skills').get() as any).c;
    const activePlannings = (db.prepare("SELECT COUNT(*) as c FROM plannings WHERE status IN ('generated', 'published')").get() as any).c;

    return { totalEmployees, activeEmployees, totalPositions, totalSkills, activePlannings, recentAlerts: [] };
  }
}

export const planningService = new PlanningService();
