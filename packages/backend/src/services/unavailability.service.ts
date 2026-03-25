import { getDatabase } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Unavailability, UnavailabilityType, DayOfWeek } from '@planning/shared';

interface UnavailabilityRow {
  id: number; employee_id: number; type: string; date: string | null;
  start_time: string | null; end_time: string | null; day_of_week: string | null;
  reason: string; is_recurring: number; created_at: string;
}

function toUnavailability(row: UnavailabilityRow): Unavailability {
  return {
    id: row.id, employeeId: row.employee_id, type: row.type as UnavailabilityType,
    date: row.date, startTime: row.start_time, endTime: row.end_time,
    dayOfWeek: row.day_of_week as DayOfWeek | null, reason: row.reason,
    isRecurring: row.is_recurring === 1, createdAt: row.created_at,
  };
}

export class UnavailabilityService {
  getByEmployee(employeeId: number): Unavailability[] {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT * FROM unavailabilities WHERE employee_id = ? ORDER BY date, start_time',
    ).all(employeeId) as UnavailabilityRow[];
    return rows.map(toUnavailability);
  }

  getById(id: number): Unavailability {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM unavailabilities WHERE id = ?').get(id) as UnavailabilityRow | undefined;
    if (!row) throw new AppError(404, 'Indisponibilité non trouvée');
    return toUnavailability(row);
  }

  create(data: {
    employeeId: number; type: UnavailabilityType; date?: string;
    startTime?: string; endTime?: string; dayOfWeek?: DayOfWeek;
    reason?: string; isRecurring?: boolean;
  }): Unavailability {
    const db = getDatabase();

    if (data.type === 'full_day' && !data.date && !data.isRecurring) {
      throw new AppError(400, 'Une date est requise pour une indisponibilité journée complète non récurrente');
    }
    if (data.type === 'time_slot' && (!data.startTime || !data.endTime)) {
      throw new AppError(400, 'Les heures de début et fin sont requises pour un créneau horaire');
    }
    if (data.type === 'recurring' && !data.dayOfWeek) {
      throw new AppError(400, 'Le jour de la semaine est requis pour une indisponibilité récurrente');
    }

    const result = db.prepare(`
      INSERT INTO unavailabilities (employee_id, type, date, start_time, end_time, day_of_week, reason, is_recurring)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.employeeId, data.type, data.date || null, data.startTime || null,
      data.endTime || null, data.dayOfWeek || null, data.reason || '',
      data.isRecurring ? 1 : 0,
    );

    return this.getById(Number(result.lastInsertRowid));
  }

  update(id: number, data: Partial<{
    type: UnavailabilityType; date: string; startTime: string; endTime: string;
    dayOfWeek: DayOfWeek; reason: string; isRecurring: boolean;
  }>): Unavailability {
    const db = getDatabase();
    this.getById(id);

    const fieldMap: Record<string, string> = {
      type: 'type', date: 'date', startTime: 'start_time', endTime: 'end_time',
      dayOfWeek: 'day_of_week', reason: 'reason',
    };

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [key, col] of Object.entries(fieldMap)) {
      const val = data[key as keyof typeof data];
      if (val !== undefined) { updates.push(`${col} = ?`); values.push(val as string); }
    }
    if (data.isRecurring !== undefined) {
      updates.push('is_recurring = ?'); values.push(data.isRecurring ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE unavailabilities SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.getById(id);
  }

  delete(id: number): void {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM unavailabilities WHERE id = ?').run(id);
    if (result.changes === 0) throw new AppError(404, 'Indisponibilité non trouvée');
  }

  isEmployeeAvailable(employeeId: number, date: string, startTime: string, endTime: string): boolean {
    const db = getDatabase();
    const dayIndex = new Date(date).getDay();
    const daysMap = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dayOfWeek = daysMap[dayIndex];

    // Vérifier journée complète
    const fullDay = db.prepare(`
      SELECT id FROM unavailabilities
      WHERE employee_id = ? AND type = 'full_day' AND date = ?
    `).get(employeeId, date);
    if (fullDay) return false;

    // Vérifier créneau horaire spécifique
    const timeSlot = db.prepare(`
      SELECT id FROM unavailabilities
      WHERE employee_id = ? AND type = 'time_slot' AND date = ?
      AND start_time < ? AND end_time > ?
    `).get(employeeId, date, endTime, startTime);
    if (timeSlot) return false;

    // Vérifier récurrences
    const recurring = db.prepare(`
      SELECT id FROM unavailabilities
      WHERE employee_id = ? AND type = 'recurring' AND day_of_week = ?
      AND (start_time IS NULL OR (start_time < ? AND end_time > ?))
    `).get(employeeId, dayOfWeek, endTime, startTime);
    if (recurring) return false;

    return true;
  }
}

export const unavailabilityService = new UnavailabilityService();
