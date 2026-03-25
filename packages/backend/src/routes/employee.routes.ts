import { Router, Request, Response } from 'express';
import { employeeService } from '../services/employee.service.js';
import { unavailabilityService } from '../services/unavailability.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  EmployeeCreateSchema, EmployeeUpdateSchema,
  EmployeeSkillRatingsSchema, EmployeePositionPreferencesSchema,
  UnavailabilityCreateSchema, WorkLimitsSchema,
} from '@planning/shared';
import type { EmployeeStatus } from '@planning/shared';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const status = req.query.status as EmployeeStatus | undefined;
  const detailed = req.query.detailed === 'true';
  if (detailed) {
    const employees = employeeService.getAllWithDetails();
    res.json({ success: true, data: employees });
  } else {
    const employees = employeeService.getAll(status);
    res.json({ success: true, data: employees });
  }
});

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const detailed = req.query.detailed === 'true';
  const id = parseInt(req.params.id!, 10);
  if (detailed) {
    const employee = employeeService.getWithDetails(id);
    res.json({ success: true, data: employee });
  } else {
    const employee = employeeService.getById(id);
    res.json({ success: true, data: employee });
  }
});

router.post('/', authenticate, authorize('admin', 'manager'), validate(EmployeeCreateSchema), (req: Request, res: Response) => {
  const employee = employeeService.create(req.body);
  res.status(201).json({ success: true, data: employee });
});

router.put('/:id', authenticate, authorize('admin', 'manager'), validate(EmployeeUpdateSchema), (req: Request, res: Response) => {
  const employee = employeeService.update(parseInt(req.params.id!, 10), req.body);
  res.json({ success: true, data: employee });
});

router.delete('/:id', authenticate, authorize('admin'), (req: Request, res: Response) => {
  employeeService.delete(parseInt(req.params.id!, 10));
  res.json({ success: true, message: 'Employ\u00e9 supprim\u00e9' });
});

// Compétences de l'employé
router.put('/:id/skills', authenticate, authorize('admin', 'manager'), validate(EmployeeSkillRatingsSchema), (req: Request, res: Response) => {
  const ratings = employeeService.setSkillRatings(parseInt(req.params.id!, 10), req.body);
  res.json({ success: true, data: ratings });
});

// Préférences de poste
router.put('/:id/preferences', authenticate, authorize('admin', 'manager'), validate(EmployeePositionPreferencesSchema), (req: Request, res: Response) => {
  const prefs = employeeService.setPositionPreferences(parseInt(req.params.id!, 10), req.body);
  res.json({ success: true, data: prefs });
});

// Limites horaires
router.put('/:id/work-limits', authenticate, authorize('admin', 'manager'), validate(WorkLimitsSchema), (req: Request, res: Response) => {
  const limits = employeeService.setWorkLimits(parseInt(req.params.id!, 10), req.body);
  res.json({ success: true, data: limits });
});

// Indisponibilités
router.get('/:id/unavailabilities', authenticate, (req: Request, res: Response) => {
  const items = unavailabilityService.getByEmployee(parseInt(req.params.id!, 10));
  res.json({ success: true, data: items });
});

router.post('/:id/unavailabilities', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  const data = { ...req.body, employeeId: parseInt(req.params.id!, 10) };
  const parsed = UnavailabilityCreateSchema.parse(data);
  const item = unavailabilityService.create(parsed);
  res.status(201).json({ success: true, data: item });
});

router.delete('/:id/unavailabilities/:unavId', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  unavailabilityService.delete(parseInt(req.params.unavId!, 10));
  res.json({ success: true, message: 'Indisponibilit\u00e9 supprim\u00e9e' });
});

export { router as employeeRoutes };
