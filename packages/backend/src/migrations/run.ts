import { getDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { migrations } from './index.js';

export function runMigrations(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const executed = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name),
  );

  const pending = migrations.filter((m) => !executed.has(m.name));

  if (pending.length === 0) {
    logger.info('Aucune migration en attente');
    return;
  }

  const runAll = db.transaction(() => {
    for (const migration of pending) {
      logger.info(`Exécution de la migration : ${migration.name}`);
      migration.up(db);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
      logger.info(`Migration terminée : ${migration.name}`);
    }
  });

  runAll();
  logger.info(`${pending.length} migration(s) exécutée(s)`);
}

// Appel direct
runMigrations();
