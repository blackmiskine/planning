import { Router, Request, Response } from 'express';
import { positionService } from '../services/position.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PositionCreateSchema, PositionUpdateSchema } from '@planning/shared';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response) => {
  const detailed = req.query.detailed === 'true';
  if (detailed) {
    const positions = positionService.getAllWithRequirements();
    res.json({ success: true, data: positions });
  } else {
    const positions = positionService.getAll();
    res.json({ success: true, data: positions });
  }
});

router.get('/:id', authenticate, (req: Request, res: Response) => {
  const position = positionService.getWithRequirements(parseInt(req.params.id!, 10));
  res.json({ success: true, data: position });
});

router.post('/', authenticate, authorize('admin', 'manager'), validate(PositionCreateSchema), (req: Request, res: Response) => {
  const position = positionService.create(req.body);
  res.status(201).json({ success: true, data: position });
});

router.put('/:id', authenticate, authorize('admin', 'manager'), validate(PositionUpdateSchema), (req: Request, res: Response) => {
  const position = positionService.update(parseInt(req.params.id!, 10), req.body);
  res.json({ success: true, data: position });
});

router.delete('/:id', authenticate, authorize('admin'), (req: Request, res: Response) => {
  positionService.delete(parseInt(req.params.id!, 10));
  res.json({ success: true, message: 'Poste supprim\u00e9' });
});

export { router as positionRoutes };
