import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    path: process.env.DB_PATH || './data/planning.sqlite',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  defaults: {
    maxHoursPerDay: parseInt(process.env.DEFAULT_MAX_HOURS_DAY || '10', 10),
    maxHoursPerWeek: parseInt(process.env.DEFAULT_MAX_HOURS_WEEK || '44', 10),
    maxHoursPerMonth: parseInt(process.env.DEFAULT_MAX_HOURS_MONTH || '176', 10),
  },
  optimizer: {
    seed: parseInt(process.env.OPTIMIZER_SEED || '42', 10),
  },
  backup: {
    dir: process.env.BACKUP_DIR || './data/backups',
    maxCount: parseInt(process.env.BACKUP_MAX_COUNT || '10', 10),
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;
