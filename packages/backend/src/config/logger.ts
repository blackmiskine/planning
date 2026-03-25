import winston from 'winston';
import { config } from './index.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: config.log.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
});

if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  );
  logger.add(
    new winston.transports.File({ filename: 'logs/combined.log' }),
  );
}
