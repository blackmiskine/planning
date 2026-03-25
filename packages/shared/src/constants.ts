export const SKILL_LEVELS = {
  1: 'Débutant',
  2: 'Intermédiaire',
  3: 'Confirmé',
  4: 'Avancé',
  5: 'Expert',
} as const;

export const SKILL_CATEGORIES = [
  'cuisine',
  'salle',
  'hébergement',
  'administration',
  'polyvalent',
] as const;

export const CONTRACT_TYPES = ['CDI', 'CDD', 'Extra', 'Saisonnier'] as const;

export const EMPLOYEE_STATUSES = ['actif', 'inactif'] as const;

export const USER_ROLES = ['admin', 'manager', 'consultation'] as const;

export const DAYS_OF_WEEK = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const;

export const DEFAULT_WORK_LIMITS = {
  maxHoursPerDay: 10,
  maxHoursPerWeek: 44,
  maxHoursPerMonth: 176,
} as const;

export const OPTIMIZER_WEIGHTS = {
  skillAdequacy: 0.40,
  positionPreference: 0.25,
  hourEquity: 0.25,
  bonusSkills: 0.10,
} as const;
