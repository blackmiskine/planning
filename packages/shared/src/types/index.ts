import type { SKILL_CATEGORIES, CONTRACT_TYPES, EMPLOYEE_STATUSES, USER_ROLES, DAYS_OF_WEEK } from '../constants.js';

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
export type ContractType = (typeof CONTRACT_TYPES)[number];
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export interface Skill {
  id: number;
  name: string;
  description: string;
  category: SkillCategory;
  createdAt: string;
  updatedAt: string;
}

export interface SkillCreate {
  name: string;
  description?: string;
  category: SkillCategory;
}

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
  contractType: ContractType;
  status: EmployeeStatus;
  photo: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeWithDetails extends Employee {
  skillRatings: EmployeeSkillRating[];
  positionPreferences: EmployeePositionPreference[];
  workLimits: WorkLimits | null;
}

export interface EmployeeSkillRating {
  id: number;
  employeeId: number;
  skillId: number;
  rating: SkillLevel;
  skillName?: string;
  skillCategory?: SkillCategory;
}

export interface EmployeePositionPreference {
  id: number;
  employeeId: number;
  positionId: number;
  rank: number;
  positionName?: string;
}

export interface Position {
  id: number;
  name: string;
  description: string;
  color: string;
  defaultHeadcount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PositionWithRequirements extends Position {
  skillRequirements: PositionSkillRequirement[];
}

export interface PositionSkillRequirement {
  id: number;
  positionId: number;
  skillId: number;
  minimumLevel: SkillLevel;
  isRequired: boolean;
  skillName?: string;
}

export type UnavailabilityType = 'full_day' | 'time_slot' | 'recurring';

export interface Unavailability {
  id: number;
  employeeId: number;
  type: UnavailabilityType;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  dayOfWeek: DayOfWeek | null;
  reason: string;
  isRecurring: boolean;
  createdAt: string;
}

export interface WorkLimits {
  id: number;
  employeeId: number;
  maxHoursPerDay: number | null;
  maxHoursPerWeek: number | null;
  maxHoursPerMonth: number | null;
}

export interface EstablishmentSettings {
  id: number;
  defaultMaxHoursPerDay: number;
  defaultMaxHoursPerWeek: number;
  defaultMaxHoursPerMonth: number;
  establishmentName: string;
  updatedAt: string;
}

export interface SlotRequirement {
  id: number;
  planningId: number;
  positionId: number;
  date: string;
  startTime: string;
  endTime: string;
  headcount: number;
  positionName?: string;
  positionColor?: string;
}

export interface Planning {
  id: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'generated' | 'published';
  qualityScore: number | null;
  coverageScore: number | null;
  adequacyScore: number | null;
  equityScore: number | null;
  seed: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningWithDetails extends Planning {
  requirements: SlotRequirement[];
  assignments: Assignment[];
  alerts: PlanningAlert[];
}

export interface Assignment {
  id: number;
  planningId: number;
  slotRequirementId: number;
  employeeId: number;
  isManual: boolean;
  isForced: boolean;
  warnings: string[];
  employeeName?: string;
  positionName?: string;
  positionColor?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface PlanningAlert {
  type: 'uncovered' | 'overload' | 'missing_skill' | 'constraint_violation';
  severity: 'error' | 'warning' | 'info';
  message: string;
  slotRequirementId?: number;
  employeeId?: number;
  date?: string;
}

export interface PlanningQualityReport {
  overallScore: number;
  coverageScore: number;
  adequacyScore: number;
  equityScore: number;
  totalSlots: number;
  coveredSlots: number;
  uncoveredSlots: number;
  averageSkillMatch: number;
  hoursDistribution: { employeeId: number; employeeName: string; totalHours: number }[];
  alerts: PlanningAlert[];
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
