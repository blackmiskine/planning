import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { LoginSchema, UserCreateSchema, UserUpdateSchema } from '@planning/shared';

const router = Router();

router.post('/login', validate(LoginSchema), (req: Request, res: Response) => {
  const result = authService.login(req.body.email, req.body.password);
  res.json({ success: true, data: result });
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  const db = (await import('../config/database.js')).getDatabase();
  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.user!.userId);
  res.json({ success: true, data: user });
});

router.get('/users', authenticate, authorize('admin'), (_req: Request, res: Response) => {
  const users = authService.getUsers();
  res.json({ success: true, data: users });
});

router.post('/users', authenticate, authorize('admin'), validate(UserCreateSchema), (req: Request, res: Response) => {
  const user = authService.createUser(req.body);
  res.status(201).json({ success: true, data: user });
});

router.put('/users/:id', authenticate, authorize('admin'), validate(UserUpdateSchema), (req: Request, res: Response) => {
  const user = authService.updateUser(parseInt(req.params.id!, 10), req.body);
  res.json({ success: true, data: user });
});

router.delete('/users/:id', authenticate, authorize('admin'), (req: Request, res: Response) => {
  authService.deleteUser(parseInt(req.params.id!, 10));
  res.json({ success: true, message: 'Utilisateur supprim\u00e9' });
});

export { router as authRoutes };
