import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from './index.js';
import { logger } from './logger.js';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(config.db.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(config.db.path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    logger.info(`Base de données connectée : ${config.db.path}`);
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    logger.info('Base de données fermée');
  }
}

export function backupDatabase(): string {
  const backupDir = config.backup.dir;
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `planning-backup-${timestamp}.sqlite`);

  const database = getDatabase();
  database.backup(backupPath);
  logger.info(`Backup créé : ${backupPath}`);

  // Nettoyage des anciens backups
  const backups = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith('planning-backup-'))
    .sort()
    .reverse();

  for (const old of backups.slice(config.backup.maxCount)) {
    fs.unlinkSync(path.join(backupDir, old));
    logger.info(`Ancien backup supprimé : ${old}`);
  }

  return backupPath;
}
