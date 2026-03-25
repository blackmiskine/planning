import { Router, Request, Response } from 'express';
import { planningService } from '../services/planning.service.js';
import { settingsService } from '../services/settings.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PlanningGenerateSchema, ManualAssignmentSchema, EstablishmentSettingsSchema } from '@planning/shared';

const router = Router();

// Plannings
router.get('/', authenticate, (_req: Request, res: Response) => {
  const plannings = planningService.getAll();
  res.json({ success: true, data: plannings });
});

router.get('/dashboard', authenticate, (_req: Request, res: Response) => {
  const stats = planningService.getDashboardStats();
  res.json({ success: true, data: stats });
});

router.get('/settings', authenticate, (_req: Request, res: Response) => {
  const settings = settingsService.get();
  res.json({ success: true, data: settings });
});

router.put('/settings', authenticate, authorize('admin'), validate(EstablishmentSettingsSchema), (req: Request, res: Response) => {
  const settings = settingsService.update(req.body);
  res.json({ success: true, data: settings });
});

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const planning = planningService.getWithDetails(parseInt(req.params.id!, 10));
  res.json({ success: true, data: planning });
});

router.post('/', authenticate, authorize('admin', 'manager'), validate(PlanningGenerateSchema), (req: Request, res: Response) => {
  const planning = planningService.create(req.body);
  res.status(201).json({ success: true, data: planning });
});

router.post('/:id/generate', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  const result = planningService.generate(parseInt(req.params.id!, 10));
  res.json({ success: true, data: result });
});

router.post('/:id/publish', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  const planning = planningService.publish(parseInt(req.params.id!, 10));
  res.json({ success: true, data: planning });
});

router.post('/:id/assignments', authenticate, authorize('admin', 'manager'), validate(ManualAssignmentSchema), (req: Request, res: Response) => {
  const assignment = planningService.addManualAssignment(
    parseInt(req.params.id!, 10),
    req.body.slotRequirementId,
    req.body.employeeId,
    req.body.force || false,
  );
  res.status(201).json({ success: true, data: assignment });
});

router.delete('/:id/assignments/:assignmentId', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  planningService.removeAssignment(parseInt(req.params.id!, 10), parseInt(req.params.assignmentId!, 10));
  res.json({ success: true, message: 'Affectation supprim\u00e9e' });
});

router.delete('/:id', authenticate, authorize('admin'), (req: Request, res: Response) => {
  planningService.delete(parseInt(req.params.id!, 10));
  res.json({ success: true, message: 'Planning supprim\u00e9' });
});

export { router as planningRoutes };
