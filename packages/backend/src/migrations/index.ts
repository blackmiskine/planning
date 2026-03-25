import type Database from 'better-sqlite3';

export interface Migration {
  name: string;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    name: '001_create_users',
    up(db) {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'consultation' CHECK(role IN ('admin', 'manager', 'consultation')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS users');
    },
  },
  {
    name: '002_create_skills',
    up(db) {
      db.exec(`
        CREATE TABLE skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL CHECK(category IN ('cuisine', 'salle', 'hébergement', 'administration', 'polyvalent')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS skills');
    },
  },
  {
    name: '003_create_employees',
    up(db) {
      db.exec(`
        CREATE TABLE employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT NOT NULL DEFAULT '',
          hire_date TEXT NOT NULL,
          contract_type TEXT NOT NULL CHECK(contract_type IN ('CDI', 'CDD', 'Extra', 'Saisonnier')),
          status TEXT NOT NULL DEFAULT 'actif' CHECK(status IN ('actif', 'inactif')),
          photo TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS employees');
    },
  },
  {
    name: '004_create_employee_skill_ratings',
    up(db) {
      db.exec(`
        CREATE TABLE employee_skill_ratings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
          rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
          UNIQUE(employee_id, skill_id)
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS employee_skill_ratings');
    },
  },
  {
    name: '005_create_positions',
    up(db) {
      db.exec(`
        CREATE TABLE positions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL DEFAULT '#3B82F6',
          default_headcount INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS positions');
    },
  },
  {
    name: '006_create_position_skill_requirements',
    up(db) {
      db.exec(`
        CREATE TABLE position_skill_requirements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
          skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
          minimum_level INTEGER NOT NULL CHECK(minimum_level BETWEEN 1 AND 5),
          is_required INTEGER NOT NULL DEFAULT 1,
          UNIQUE(position_id, skill_id)
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS position_skill_requirements');
    },
  },
  {
    name: '007_create_employee_position_preferences',
    up(db) {
      db.exec(`
        CREATE TABLE employee_position_preferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
          rank INTEGER NOT NULL,
          UNIQUE(employee_id, position_id),
          UNIQUE(employee_id, rank)
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS employee_position_preferences');
    },
  },
  {
    name: '008_create_unavailabilities',
    up(db) {
      db.exec(`
        CREATE TABLE unavailabilities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('full_day', 'time_slot', 'recurring')),
          date TEXT,
          start_time TEXT,
          end_time TEXT,
          day_of_week TEXT,
          reason TEXT NOT NULL DEFAULT '',
          is_recurring INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS unavailabilities');
    },
  },
  {
    name: '009_create_work_limits',
    up(db) {
      db.exec(`
        CREATE TABLE work_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
          max_hours_per_day REAL,
          max_hours_per_week REAL,
          max_hours_per_month REAL
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS work_limits');
    },
  },
  {
    name: '010_create_establishment_settings',
    up(db) {
      db.exec(`
        CREATE TABLE establishment_settings (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          default_max_hours_per_day REAL NOT NULL DEFAULT 10,
          default_max_hours_per_week REAL NOT NULL DEFAULT 44,
          default_max_hours_per_month REAL NOT NULL DEFAULT 176,
          establishment_name TEXT NOT NULL DEFAULT 'Mon Établissement',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO establishment_settings (id) VALUES (1);
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS establishment_settings');
    },
  },
  {
    name: '011_create_plannings',
    up(db) {
      db.exec(`
        CREATE TABLE plannings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'generated', 'published')),
          quality_score REAL,
          coverage_score REAL,
          adequacy_score REAL,
          equity_score REAL,
          seed INTEGER NOT NULL DEFAULT 42,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS plannings');
    },
  },
  {
    name: '012_create_slot_requirements',
    up(db) {
      db.exec(`
        CREATE TABLE slot_requirements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          planning_id INTEGER NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
          position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          headcount INTEGER NOT NULL DEFAULT 1
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS slot_requirements');
    },
  },
  {
    name: '013_create_assignments',
    up(db) {
      db.exec(`
        CREATE TABLE assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          planning_id INTEGER NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
          slot_requirement_id INTEGER NOT NULL REFERENCES slot_requirements(id) ON DELETE CASCADE,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          is_manual INTEGER NOT NULL DEFAULT 0,
          is_forced INTEGER NOT NULL DEFAULT 0,
          warnings TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
    down(db) {
      db.exec('DROP TABLE IF EXISTS assignments');
    },
  },
];
