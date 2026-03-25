import { Router, Request, Response } from 'express';
import { skillService } from '../services/skill.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { SkillCreateSchema, SkillUpdateSchema } from '@planning/shared';

const router = Router();

router.get('/', authenticate, (_req: Request, res: Response) => {
  const skills = skillService.getAll();
  res.json({ success: true, data: skills });
});

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const skill = skillService.getById(parseInt(req.params.id!, 10));
  res.json({ success: true, data: skill });
});

router.post('/', authenticate, authorize('admin', 'manager'), validate(SkillCreateSchema), (req: Request, res: Response) => {
  const skill = skillService.create(req.body);
  res.status(201).json({ success: true, data: skill });
});

router.put('/:id', authenticate, authorize('admin', 'manager'), validate(SkillUpdateSchema), (req: Request, res: Response) => {
  const skill = skillService.update(parseInt(req.params.id!, 10), req.body);
  res.json({ success: true, data: skill });
});

router.delete('/:id', authenticate, authorize('admin', 'manager'), (req: Request, res: Response) => {
  skillService.delete(parseInt(req.params.id!, 10));
  res.json({ success: true, message: 'Comp\u00e9tence supprim\u00e9e' });
});

export { router as skillRoutes };
