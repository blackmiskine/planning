import { getDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { migrations } from './index.js';

export function rollbackLastMigration(): void {
  const db = getDatabase();

  const last = db.prepare('SELECT name FROM _migrations ORDER BY id DESC LIMIT 1').get() as { name: string } | undefined;

  if (!last) {
    logger.info('Aucune migration à annuler');
    return;
  }

  const migration = migrations.find((m) => m.name === last.name);
  if (!migration) {
    logger.error(`Migration introuvable : ${last.name}`);
    return;
  }

  const rollback = db.transaction(() => {
    logger.info(`Annulation de la migration : ${migration.name}`);
    migration.down(db);
    db.prepare('DELETE FROM _migrations WHERE name = ?').run(migration.name);
    logger.info(`Migration annulée : ${migration.name}`);
  });

  rollback();
}

rollbackLastMigration();
