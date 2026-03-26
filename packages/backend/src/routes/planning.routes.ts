import { Router, Request, Response } from 'express';
import { planningService } from '../services/planning.service.js';
import { settingsService } from '../services/settings.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PlanningGenerateSchema, ManualAssignmentSchema, EstablishmentSettingsSchema, SlotRequirementSchema } from '@planning/shared';
import { z } from 'zod';

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

// Mettre a jour les metadonnees du planning
router.put('/:id', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  const planning = planningService.update(parseInt(req.params.id!, 10), req.body);
  res.json({ success: true, data: planning });
});

// Ajouter un creneau au planning
router.post('/:id/requirements', authenticate, authorize('admin', 'manager'), validate(SlotRequirementSchema), (req: Request, res: Response) => {
  const slot = planningService.addRequirement(parseInt(req.params.id!, 10), req.body);
  res.status(201).json({ success: true, data: slot });
});

// Ajouter plusieurs creneaux au planning
router.post('/:id/requirements/bulk', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  const schema = z.array(SlotRequirementSchema);
  const parsed = schema.parse(req.body);
  const slots = planningService.addRequirements(parseInt(req.params.id!, 10), parsed);
  res.status(201).json({ success: true, data: slots });
});

// Modifier un creneau
router.put('/:id/requirements/:reqId', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  const slot = planningService.updateRequirement(
    parseInt(req.params.id!, 10),
    parseInt(req.params.reqId!, 10),
    req.body,
  );
  res.json({ success: true, data: slot });
});

// Supprimer un creneau
router.delete('/:id/requirements/:reqId', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  planningService.removeRequirement(
    parseInt(req.params.id!, 10),
    parseInt(req.params.reqId!, 10),
  );
  res.json({ success: true, message: 'Creneau supprime' });
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
  res.json({ success: true, message: 'Affectation supprimee' });
});

router.delete('/:id', authenticate, authorize('admin'), (req: Request, res: Response) => {
  planningService.delete(parseInt(req.params.id!, 10));
  res.json({ success: true, message: 'Planning supprime' });
});

export { router as planningRoutes };
