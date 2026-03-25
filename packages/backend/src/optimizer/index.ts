import { getDatabase } from '../config/database.js';
import { config } from '../config/index.js';
import { unavailabilityService } from '../services/unavailability.service.js';
import { settingsService } from '../services/settings.service.js';
import { SeededRandom } from './seeded-random.js';
import { OPTIMIZER_WEIGHTS } from '@planning/shared';
import type {
  Assignment, PlanningAlert, PlanningQualityReport,
  SkillLevel, SlotRequirement,
} from '@planning/shared';
import { logger } from '../config/logger.js';

interface EmployeeData {
  id: number;
  firstName: string;
  lastName: string;
  status: string;
  skills: Map<number, number>; // skillId -> rating
  positionPrefs: Map<number, number>; // positionId -> rank
  maxHoursDay: number;
  maxHoursWeek: number;
  maxHoursMonth: number;
}

interface PositionRequirement {
  skillId: number;
  minimumLevel: number;
  isRequired: boolean;
}

interface SlotData {
  id: number;
  positionId: number;
  date: string;
  startTime: string;
  endTime: string;
  headcount: number;
  positionName: string;
  requirements: PositionRequirement[];
}

interface CandidateScore {
  employeeId: number;
  score: number;
  skillScore: number;
  prefScore: number;
  equityScore: number;
  bonusScore: number;
  warnings: string[];
}

export class PlanningOptimizer {
  private employees: EmployeeData[] = [];
  private slots: SlotData[] = [];
  private assignments: Map<number, number[]> = new Map(); // slotId -> employeeIds
  private employeeHours: Map<number, { daily: Map<string, number>; weekly: Map<string, number>; monthly: Map<string, number> }> = new Map();
  private rng: SeededRandom;
  private alerts: PlanningAlert[] = [];

  constructor(seed?: number) {
    this.rng = new SeededRandom(seed ?? config.optimizer.seed);
  }

  generate(planningId: number): { assignments: Omit<Assignment, 'id' | 'employeeName' | 'positionName' | 'positionColor' | 'date' | 'startTime' | 'endTime'>[]; alerts: PlanningAlert[]; report: PlanningQualityReport } {
    const startTime = Date.now();
    logger.info(`Début de l'optimisation pour le planning #${planningId}`);

    this.loadData(planningId);
    this.initializeTracking();

    const resultAssignments: Omit<Assignment, 'id' | 'employeeName' | 'positionName' | 'positionColor' | 'date' | 'startTime' | 'endTime'>[] = [];

    // Trier les slots par difficulté (moins de candidats éligibles = plus prioritaire)
    const sortedSlots = this.sortSlotsByDifficulty();

    for (const slot of sortedSlots) {
      for (let i = 0; i < slot.headcount; i++) {
        const alreadyAssigned = this.assignments.get(slot.id) || [];
        const candidate = this.findBestCandidate(slot, alreadyAssigned);

        if (candidate) {
          resultAssignments.push({
            planningId,
            slotRequirementId: slot.id,
            employeeId: candidate.employeeId,
            isManual: false,
            isForced: false,
            warnings: candidate.warnings,
          });

          if (!this.assignments.has(slot.id)) this.assignments.set(slot.id, []);
          this.assignments.get(slot.id)!.push(candidate.employeeId);
          this.updateEmployeeHours(candidate.employeeId, slot);
        } else {
          this.alerts.push({
            type: 'uncovered',
            severity: 'error',
            message: `Poste "${slot.positionName}" non couvert le ${slot.date} de ${slot.startTime} à ${slot.endTime} (${i + 1}/${slot.headcount})`,
            slotRequirementId: slot.id,
            date: slot.date,
          });
        }
      }
    }

    const report = this.computeQualityReport(planningId, resultAssignments);

    const elapsed = Date.now() - startTime;
    logger.info(`Optimisation terminée en ${elapsed}ms — Score: ${report.overallScore.toFixed(1)}/100`);

    return { assignments: resultAssignments, alerts: this.alerts, report };
  }

  private loadData(planningId: number): void {
    const db = getDatabase();
    const settings = settingsService.get();

    // Charger les employés actifs
    const empRows = db.prepare("SELECT * FROM employees WHERE status = 'actif'").all() as any[];
    this.employees = empRows.map((e) => {
      const skills = new Map<number, number>();
      const skillRows = db.prepare('SELECT skill_id, rating FROM employee_skill_ratings WHERE employee_id = ?').all(e.id) as any[];
      for (const s of skillRows) skills.set(s.skill_id, s.rating);

      const positionPrefs = new Map<number, number>();
      const prefRows = db.prepare('SELECT position_id, rank FROM employee_position_preferences WHERE employee_id = ?').all(e.id) as any[];
      for (const p of prefRows) positionPrefs.set(p.position_id, p.rank);

      const limits = db.prepare('SELECT * FROM work_limits WHERE employee_id = ?').get(e.id) as any;

      return {
        id: e.id,
        firstName: e.first_name,
        lastName: e.last_name,
        status: e.status,
        skills,
        positionPrefs,
        maxHoursDay: limits?.max_hours_per_day ?? settings.defaultMaxHoursPerDay,
        maxHoursWeek: limits?.max_hours_per_week ?? settings.defaultMaxHoursPerWeek,
        maxHoursMonth: limits?.max_hours_per_month ?? settings.defaultMaxHoursPerMonth,
      };
    });

    // Charger les slots
    const slotRows = db.prepare(`
      SELECT sr.*, p.name as position_name
      FROM slot_requirements sr
      JOIN positions p ON p.id = sr.position_id
      WHERE sr.planning_id = ?
      ORDER BY sr.date, sr.start_time
    `).all(planningId) as any[];

    this.slots = slotRows.map((s) => {
      const reqs = db.prepare(
        'SELECT skill_id, minimum_level, is_required FROM position_skill_requirements WHERE position_id = ?',
      ).all(s.position_id) as any[];

      return {
        id: s.id,
        positionId: s.position_id,
        date: s.date,
        startTime: s.start_time,
        endTime: s.end_time,
        headcount: s.headcount,
        positionName: s.position_name,
        requirements: reqs.map((r: any) => ({
          skillId: r.skill_id,
          minimumLevel: r.minimum_level,
          isRequired: r.is_required === 1,
        })),
      };
    });
  }

  private initializeTracking(): void {
    this.assignments.clear();
    this.employeeHours.clear();
    this.alerts = [];

    for (const emp of this.employees) {
      this.employeeHours.set(emp.id, {
        daily: new Map(),
        weekly: new Map(),
        monthly: new Map(),
      });
    }
  }

  private sortSlotsByDifficulty(): SlotData[] {
    const slotDifficulty = this.slots.map((slot) => {
      const eligible = this.employees.filter((e) => this.isEligible(e, slot));
      return { slot, difficulty: eligible.length };
    });

    slotDifficulty.sort((a, b) => a.difficulty - b.difficulty);
    return slotDifficulty.map((s) => s.slot);
  }

  private isEligible(employee: EmployeeData, slot: SlotData): boolean {
    // Vérifier compétences obligatoires
    for (const req of slot.requirements) {
      if (!req.isRequired) continue;
      const rating = employee.skills.get(req.skillId) || 0;
      if (rating < req.minimumLevel) return false;
    }
    return true;
  }

  private findBestCandidate(slot: SlotData, excludeIds: number[]): CandidateScore | null {
    const candidates: CandidateScore[] = [];
    const excludeSet = new Set(excludeIds);

    // Calculer les heures moyennes pour l'équité
    const totalHoursAll = Array.from(this.employeeHours.values()).map((h) => {
      let total = 0;
      for (const hours of h.daily.values()) total += hours;
      return total;
    });
    const avgHours = totalHoursAll.length > 0 ? totalHoursAll.reduce((a, b) => a + b, 0) / totalHoursAll.length : 0;
    const maxHoursRange = Math.max(1, Math.max(...totalHoursAll) - Math.min(...totalHoursAll) || 1);

    for (const employee of this.rng.shuffle(this.employees)) {
      if (excludeSet.has(employee.id)) continue;

      // Vérifier éligibilité (compétences obligatoires)
      if (!this.isEligible(employee, slot)) continue;

      // Vérifier disponibilité
      if (!unavailabilityService.isEmployeeAvailable(employee.id, slot.date, slot.startTime, slot.endTime)) {
        continue;
      }

      // Vérifier limites horaires
      const slotHours = this.getSlotDuration(slot);
      if (!this.canWorkMoreHours(employee.id, slot.date, slotHours, employee)) {
        continue;
      }

      // Calculer le score
      const warnings: string[] = [];

      // Score compétences (40%)
      let skillScore = 0;
      const requiredSkills = slot.requirements.filter((r) => r.isRequired);
      if (requiredSkills.length > 0) {
        const totalSkillScore = requiredSkills.reduce((sum, req) => {
          const rating = employee.skills.get(req.skillId) || 0;
          return sum + (rating - req.minimumLevel) / (5 - req.minimumLevel || 1);
        }, 0);
        skillScore = totalSkillScore / requiredSkills.length;
      } else {
        skillScore = 0.5; // Pas de compétence requise = score moyen
      }

      // Score préférence poste (25%)
      let prefScore = 0;
      const prefRank = employee.positionPrefs.get(slot.positionId);
      if (prefRank !== undefined) {
        const maxRank = employee.positionPrefs.size;
        prefScore = 1 - (prefRank - 1) / Math.max(1, maxRank);
      }

      // Score équité (25%)
      const empTotalHours = this.getEmployeeTotalHours(employee.id);
      const equityScore = avgHours > 0 ? Math.max(0, 1 - (empTotalHours - avgHours + maxHoursRange) / (2 * maxHoursRange)) : 1;

      // Score compétences bonus (10%)
      const bonusSkills = slot.requirements.filter((r) => !r.isRequired);
      let bonusScore = 0;
      if (bonusSkills.length > 0) {
        const bonusMatch = bonusSkills.filter((r) => {
          const rating = employee.skills.get(r.skillId) || 0;
          return rating >= r.minimumLevel;
        }).length;
        bonusScore = bonusMatch / bonusSkills.length;
      }

      const totalScore =
        OPTIMIZER_WEIGHTS.skillAdequacy * skillScore +
        OPTIMIZER_WEIGHTS.positionPreference * prefScore +
        OPTIMIZER_WEIGHTS.hourEquity * equityScore +
        OPTIMIZER_WEIGHTS.bonusSkills * bonusScore;

      candidates.push({
        employeeId: employee.id,
        score: totalScore,
        skillScore,
        prefScore,
        equityScore,
        bonusScore,
        warnings,
      });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]!;
  }

  private getSlotDuration(slot: SlotData): number {
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    let hours = (eh! - sh!) + (em! - sm!) / 60;
    if (hours < 0) hours += 24; // Passage minuit
    return hours;
  }

  private canWorkMoreHours(employeeId: number, date: string, additionalHours: number, employee: EmployeeData): boolean {
    const tracking = this.employeeHours.get(employeeId);
    if (!tracking) return true;

    // Limite journalière
    const dailyHours = (tracking.daily.get(date) || 0) + additionalHours;
    if (dailyHours > employee.maxHoursDay) return false;

    // Limite hebdomadaire
    const weekKey = this.getWeekKey(date);
    const weeklyHours = (tracking.weekly.get(weekKey) || 0) + additionalHours;
    if (weeklyHours > employee.maxHoursWeek) return false;

    // Limite mensuelle
    const monthKey = date.substring(0, 7);
    const monthlyHours = (tracking.monthly.get(monthKey) || 0) + additionalHours;
    if (monthlyHours > employee.maxHoursMonth) return false;

    return true;
  }

  private updateEmployeeHours(employeeId: number, slot: SlotData): void {
    const tracking = this.employeeHours.get(employeeId);
    if (!tracking) return;

    const hours = this.getSlotDuration(slot);

    tracking.daily.set(slot.date, (tracking.daily.get(slot.date) || 0) + hours);

    const weekKey = this.getWeekKey(slot.date);
    tracking.weekly.set(weekKey, (tracking.weekly.get(weekKey) || 0) + hours);

    const monthKey = slot.date.substring(0, 7);
    tracking.monthly.set(monthKey, (tracking.monthly.get(monthKey) || 0) + hours);
  }

  private getWeekKey(date: string): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().substring(0, 10);
  }

  private getEmployeeTotalHours(employeeId: number): number {
    const tracking = this.employeeHours.get(employeeId);
    if (!tracking) return 0;
    let total = 0;
    for (const hours of tracking.daily.values()) total += hours;
    return total;
  }

  private computeQualityReport(
    planningId: number,
    assignments: Omit<Assignment, 'id' | 'employeeName' | 'positionName' | 'positionColor' | 'date' | 'startTime' | 'endTime'>[],
  ): PlanningQualityReport {
    const totalSlotsNeeded = this.slots.reduce((sum, s) => sum + s.headcount, 0);
    const coveredSlots = assignments.length;
    const uncoveredSlots = totalSlotsNeeded - coveredSlots;

    const coverageScore = totalSlotsNeeded > 0 ? (coveredSlots / totalSlotsNeeded) * 100 : 100;

    // Score d'adéquation moyen
    let totalSkillMatch = 0;
    for (const assignment of assignments) {
      const slot = this.slots.find((s) => s.id === assignment.slotRequirementId);
      const emp = this.employees.find((e) => e.id === assignment.employeeId);
      if (slot && emp) {
        const requiredSkills = slot.requirements.filter((r) => r.isRequired);
        if (requiredSkills.length > 0) {
          const match = requiredSkills.reduce((sum, req) => {
            const rating = emp.skills.get(req.skillId) || 0;
            return sum + Math.min(1, rating / 5);
          }, 0) / requiredSkills.length;
          totalSkillMatch += match;
        } else {
          totalSkillMatch += 0.7;
        }
      }
    }
    const adequacyScore = assignments.length > 0 ? (totalSkillMatch / assignments.length) * 100 : 0;

    // Score d'équité
    const hoursDistribution: { employeeId: number; employeeName: string; totalHours: number }[] = [];
    for (const emp of this.employees) {
      const totalHours = this.getEmployeeTotalHours(emp.id);
      if (totalHours > 0) {
        hoursDistribution.push({
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          totalHours,
        });
      }
    }

    let equityScore = 100;
    if (hoursDistribution.length > 1) {
      const hours = hoursDistribution.map((h) => h.totalHours);
      const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
      const variance = hours.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hours.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      equityScore = Math.max(0, (1 - cv) * 100);
    }

    // Vérifier les surcharges
    for (const emp of this.employees) {
      const totalHours = this.getEmployeeTotalHours(emp.id);
      const tracking = this.employeeHours.get(emp.id);
      if (tracking) {
        for (const [date, hours] of tracking.daily) {
          if (hours > emp.maxHoursDay * 0.9) {
            this.alerts.push({
              type: 'overload',
              severity: hours > emp.maxHoursDay ? 'error' : 'warning',
              message: `${emp.firstName} ${emp.lastName} : ${hours.toFixed(1)}h le ${date} (max: ${emp.maxHoursDay}h)`,
              employeeId: emp.id,
              date,
            });
          }
        }
      }
    }

    const overallScore = (
      coverageScore * 0.4 +
      adequacyScore * 0.3 +
      equityScore * 0.3
    );

    return {
      overallScore,
      coverageScore,
      adequacyScore,
      equityScore,
      totalSlots: totalSlotsNeeded,
      coveredSlots,
      uncoveredSlots,
      averageSkillMatch: assignments.length > 0 ? totalSkillMatch / assignments.length : 0,
      hoursDistribution,
      alerts: this.alerts,
    };
  }

  validateManualAssignment(
    planningId: number,
    slotRequirementId: number,
    employeeId: number,
  ): { valid: boolean; warnings: string[] } {
    const db = getDatabase();
    const warnings: string[] = [];

    const slot = db.prepare(`
      SELECT sr.*, p.name as position_name
      FROM slot_requirements sr
      JOIN positions p ON p.id = sr.position_id
      WHERE sr.id = ? AND sr.planning_id = ?
    `).get(slotRequirementId, planningId) as any;

    if (!slot) return { valid: false, warnings: ['Créneau non trouvé'] };

    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as any;
    if (!emp) return { valid: false, warnings: ['Employé non trouvé'] };

    // Vérifier compétences
    const requirements = db.prepare(
      'SELECT * FROM position_skill_requirements WHERE position_id = ? AND is_required = 1',
    ).all(slot.position_id) as any[];

    for (const req of requirements) {
      const rating = db.prepare(
        'SELECT rating FROM employee_skill_ratings WHERE employee_id = ? AND skill_id = ?',
      ).get(employeeId, req.skill_id) as any;

      if (!rating || rating.rating < req.minimum_level) {
        const skill = db.prepare('SELECT name FROM skills WHERE id = ?').get(req.skill_id) as any;
        warnings.push(`Compétence "${skill?.name}" insuffisante : niveau ${rating?.rating || 0}/${req.minimum_level} requis`);
      }
    }

    // Vérifier disponibilité
    if (!unavailabilityService.isEmployeeAvailable(employeeId, slot.date, slot.start_time, slot.end_time)) {
      warnings.push('Employé indisponible sur ce créneau');
    }

    return { valid: warnings.length === 0, warnings };
  }
}
