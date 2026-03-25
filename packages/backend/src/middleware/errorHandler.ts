import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  logger.error('Erreur non gérée :', err);
  res.status(500).json({
    success: false,
    error: 'Erreur interne du serveur',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route non trouvée : ${req.method} ${req.path}`,
  });
}
