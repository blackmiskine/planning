import { getDatabase } from '../config/database.js';
import type { EstablishmentSettings } from '@planning/shared';

interface SettingsRow {
  id: number; default_max_hours_per_day: number; default_max_hours_per_week: number;
  default_max_hours_per_month: number; establishment_name: string; updated_at: string;
}

function toSettings(row: SettingsRow): EstablishmentSettings {
  return {
    id: row.id,
    defaultMaxHoursPerDay: row.default_max_hours_per_day,
    defaultMaxHoursPerWeek: row.default_max_hours_per_week,
    defaultMaxHoursPerMonth: row.default_max_hours_per_month,
    establishmentName: row.establishment_name,
    updatedAt: row.updated_at,
  };
}

export class SettingsService {
  get(): EstablishmentSettings {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM establishment_settings WHERE id = 1').get() as SettingsRow;
    return toSettings(row);
  }

  update(data: Partial<{
    defaultMaxHoursPerDay: number; defaultMaxHoursPerWeek: number;
    defaultMaxHoursPerMonth: number; establishmentName: string;
  }>): EstablishmentSettings {
    const db = getDatabase();
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (data.defaultMaxHoursPerDay !== undefined) {
      updates.push('default_max_hours_per_day = ?'); values.push(data.defaultMaxHoursPerDay);
    }
    if (data.defaultMaxHoursPerWeek !== undefined) {
      updates.push('default_max_hours_per_week = ?'); values.push(data.defaultMaxHoursPerWeek);
    }
    if (data.defaultMaxHoursPerMonth !== undefined) {
      updates.push('default_max_hours_per_month = ?'); values.push(data.defaultMaxHoursPerMonth);
    }
    if (data.establishmentName !== undefined) {
      updates.push('establishment_name = ?'); values.push(data.establishmentName);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      db.prepare(`UPDATE establishment_settings SET ${updates.join(', ')} WHERE id = 1`).run(...values);
    }

    return this.get();
  }
}

export const settingsService = new SettingsService();
