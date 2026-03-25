import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { runMigrations } from './migrations/run.js';
import { authService } from './services/auth.service.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.routes.js';
import { skillRoutes } from './routes/skill.routes.js';
import { employeeRoutes } from './routes/employee.routes.js';
import { positionRoutes } from './routes/position.routes.js';
import { planningRoutes } from './routes/planning.routes.js';

const app = express();

// Middleware globaux
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.info(message.trim()) },
}));

// Servir les fichiers statiques du frontend en production
if (config.nodeEnv === 'production') {
  const frontendPath = path.resolve(process.cwd(), 'packages/frontend/dist');
  app.use(express.static(frontendPath));
}

// Routes API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/skills', skillRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/positions', positionRoutes);
app.use('/api/v1/plannings', planningRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() } });
});

// SPA fallback en production
if (config.nodeEnv === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'packages/frontend/dist/index.html'));
  });
}

// Gestion des erreurs
app.use(notFoundHandler);
app.use(errorHandler);

// Démarrage
function start() {
  try {
    runMigrations();
    authService.ensureAdminExists();
    logger.info('Admin par défaut vérifié (admin@planning.local / admin123)');

    app.listen(config.port, () => {
      logger.info(`Serveur démarré sur le port ${config.port} [${config.nodeEnv}]`);
      logger.info(`API disponible sur http://localhost:${config.port}/api/v1`);
    });
  } catch (error) {
    logger.error('Erreur au démarrage :', error);
    process.exit(1);
  }
}

start();

export { app };
