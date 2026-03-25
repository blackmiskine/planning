import { z } from 'zod';
import { SKILL_CATEGORIES, CONTRACT_TYPES, EMPLOYEE_STATUSES, USER_ROLES, DAYS_OF_WEEK } from './constants.js';

export const SkillCreateSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100),
  description: z.string().max(500).optional().default(''),
  category: z.enum(SKILL_CATEGORIES),
});

export const SkillUpdateSchema = SkillCreateSchema.partial();

export const EmployeeCreateSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis').max(100),
  lastName: z.string().min(1, 'Le nom est requis').max(100),
  email: z.string().email('Email invalide'),
  phone: z.string().max(20).optional().default(''),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  contractType: z.enum(CONTRACT_TYPES),
  status: z.enum(EMPLOYEE_STATUSES).default('actif'),
  photo: z.string().optional().default(''),
});

export const EmployeeUpdateSchema = EmployeeCreateSchema.partial();

export const EmployeeSkillRatingSchema = z.object({
  skillId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
});

export const EmployeeSkillRatingsSchema = z.array(EmployeeSkillRatingSchema);

export const EmployeePositionPreferenceSchema = z.object({
  positionId: z.number().int().positive(),
  rank: z.number().int().positive(),
});

export const EmployeePositionPreferencesSchema = z.array(EmployeePositionPreferenceSchema);

export const PositionSkillRequirementSchema = z.object({
  skillId: z.number().int().positive(),
  minimumLevel: z.number().int().min(1).max(5),
  isRequired: z.boolean(),
});

export const PositionCreateSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100),
  description: z.string().max(500).optional().default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale invalide').optional().default('#3B82F6'),
  defaultHeadcount: z.number().int().min(1).default(1),
  skillRequirements: z.array(PositionSkillRequirementSchema).optional().default([]),
});

export const PositionUpdateSchema = PositionCreateSchema.partial();

export const UnavailabilityCreateSchema = z.object({
  employeeId: z.number().int().positive(),
  type: z.enum(['full_day', 'time_slot', 'recurring']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dayOfWeek: z.enum(DAYS_OF_WEEK).optional(),
  reason: z.string().max(200).optional().default(''),
  isRecurring: z.boolean().default(false),
});

export const UnavailabilityUpdateSchema = UnavailabilityCreateSchema.partial().omit({ employeeId: true });

export const WorkLimitsSchema = z.object({
  maxHoursPerDay: z.number().min(0).max(24).optional(),
  maxHoursPerWeek: z.number().min(0).max(168).optional(),
  maxHoursPerMonth: z.number().min(0).max(744).optional(),
});

export const EstablishmentSettingsSchema = z.object({
  defaultMaxHoursPerDay: z.number().min(0).max(24),
  defaultMaxHoursPerWeek: z.number().min(0).max(168),
  defaultMaxHoursPerMonth: z.number().min(0).max(744),
  establishmentName: z.string().min(1).max(200).optional(),
});

export const SlotRequirementSchema = z.object({
  positionId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  headcount: z.number().int().min(1),
});

export const PlanningGenerateSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requirements: z.array(SlotRequirementSchema).min(1),
  seed: z.number().int().optional(),
});

export const ManualAssignmentSchema = z.object({
  slotRequirementId: z.number().int().positive(),
  employeeId: z.number().int().positive(),
  force: z.boolean().default(false),
});

export const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

export const UserCreateSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  name: z.string().min(1, 'Le nom est requis').max(100),
  role: z.enum(USER_ROLES).default('consultation'),
});

export const UserUpdateSchema = UserCreateSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).optional(),
});
