import type { VercelRequest, VercelResponse } from '@vercel/node';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vercel-planning-secret-2026';
const JWT_EXPIRES_IN = '24h';

let db: SqlJsDatabase | null = null;

function query(sql: string, params: any[] = []): any[] {
  const stmt = db!.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) { results.push(stmt.getAsObject()); }
  stmt.free();
  return results;
}

function run(sql: string, params: any[] = []): { changes: number; lastId: number } {
  db!.run(sql, params);
  const changes = db!.getRowsModified();
  const res = db!.exec('SELECT last_insert_rowid() as id');
  const lastId = res.length > 0 ? Number(res[0]!.values[0]![0]) : 0;
  return { changes, lastId };
}

function exec(sql: string): void { db!.exec(sql); }

function runMigrations() {
  exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, executed_at TEXT DEFAULT (datetime('now')))`);
  const done = new Set(query('SELECT name FROM _migrations').map((r: any) => r.name));
  const migrations: [string, string][] = [
    ['001_users', `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'consultation', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`],
    ['002_skills', `CREATE TABLE skills (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, description TEXT DEFAULT '', category TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`],
    ['003_employees', `CREATE TABLE employees (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT DEFAULT '', hire_date TEXT NOT NULL, contract_type TEXT NOT NULL, status TEXT DEFAULT 'actif', photo TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`],
    ['004_skill_ratings', `CREATE TABLE employee_skill_ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE, skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE, rating INTEGER NOT NULL, UNIQUE(employee_id, skill_id))`],
    ['005_positions', `CREATE TABLE positions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, description TEXT DEFAULT '', color TEXT DEFAULT '#3B82F6', default_headcount INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`],
    ['006_pos_skill_reqs', `CREATE TABLE position_skill_requirements (id INTEGER PRIMARY KEY AUTOINCREMENT, position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE, skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE, minimum_level INTEGER NOT NULL, is_required INTEGER DEFAULT 1, UNIQUE(position_id, skill_id))`],
    ['007_emp_pos_prefs', `CREATE TABLE employee_position_preferences (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE, position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE, rank INTEGER NOT NULL, UNIQUE(employee_id, position_id))`],
    ['008_unavailabilities', `CREATE TABLE unavailabilities (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE, type TEXT NOT NULL, date TEXT, start_time TEXT, end_time TEXT, day_of_week TEXT, reason TEXT DEFAULT '', is_recurring INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`],
    ['009_work_limits', `CREATE TABLE work_limits (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER UNIQUE REFERENCES employees(id) ON DELETE CASCADE, max_hours_per_day REAL, max_hours_per_week REAL, max_hours_per_month REAL)`],
    ['010_settings', `CREATE TABLE establishment_settings (id INTEGER PRIMARY KEY CHECK(id=1), default_max_hours_per_day REAL DEFAULT 10, default_max_hours_per_week REAL DEFAULT 44, default_max_hours_per_month REAL DEFAULT 176, establishment_name TEXT DEFAULT 'Mon Etablissement', updated_at TEXT DEFAULT (datetime('now'))); INSERT INTO establishment_settings (id) VALUES (1)`],
    ['011_plannings', `CREATE TABLE plannings (id INTEGER PRIMARY KEY AUTOINCREMENT, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT DEFAULT 'draft', quality_score REAL, coverage_score REAL, adequacy_score REAL, equity_score REAL, seed INTEGER DEFAULT 42, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`],
    ['012_slot_reqs', `CREATE TABLE slot_requirements (id INTEGER PRIMARY KEY AUTOINCREMENT, planning_id INTEGER REFERENCES plannings(id) ON DELETE CASCADE, position_id INTEGER REFERENCES positions(id) ON DELETE CASCADE, date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, headcount INTEGER DEFAULT 1)`],
    ['013_assignments', `CREATE TABLE assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, planning_id INTEGER REFERENCES plannings(id) ON DELETE CASCADE, slot_requirement_id INTEGER REFERENCES slot_requirements(id) ON DELETE CASCADE, employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE, is_manual INTEGER DEFAULT 0, is_forced INTEGER DEFAULT 0, warnings TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')))`],
  ];
  for (const [name, sql] of migrations) {
    if (!done.has(name)) { exec(sql); run('INSERT INTO _migrations (name) VALUES (?)', [name]); }
  }
}

function ensureAdmin() {
  const admin = query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (admin.length === 0) {
    const hash = bcrypt.hashSync('admin123', 12);
    run('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)', ['admin@planning.local', hash, 'Administrateur', 'admin']);
  }
}

function authenticate(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Token requis' });
  try { req.user = jwt.verify(auth.slice(7), JWT_SECRET) as any; next(); }
  catch { res.status(401).json({ success: false, error: 'Token invalide' }); }
}

function authorize(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Non authentifie' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, error: 'Permissions insuffisantes' });
    next();
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_r, res) => res.json({ success: true, data: { status: 'ok', env: 'vercel' } }));

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = query('SELECT * FROM users WHERE email=?', [email])[0] as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
  res.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.created_at } } });
});

app.get('/api/v1/auth/me', authenticate, (req: any, res) => {
  res.json({ success: true, data: query('SELECT id, email, name, role, created_at FROM users WHERE id=?', [req.user.userId])[0] });
});

app.get('/api/v1/auth/users', authenticate, authorize('admin'), (_r, res) => {
  res.json({ success: true, data: query('SELECT id, email, name, role, created_at FROM users ORDER BY name') });
});

app.post('/api/v1/auth/users', authenticate, authorize('admin'), (req, res) => {
  const { email, password, name, role } = req.body;
  const hash = bcrypt.hashSync(password, 12);
  const { lastId } = run('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)', [email, hash, name, role || 'consultation']);
  res.status(201).json({ success: true, data: query('SELECT id, email, name, role, created_at FROM users WHERE id=?', [lastId])[0] });
});

app.put('/api/v1/auth/users/:id', authenticate, authorize('admin'), (req, res) => {
  const id = parseInt(req.params.id!);
  const { name, email, password, role } = req.body;
  if (name) run('UPDATE users SET name=? WHERE id=?', [name, id]);
  if (email) run('UPDATE users SET email=? WHERE id=?', [email, id]);
  if (role) run('UPDATE users SET role=? WHERE id=?', [role, id]);
  if (password) run('UPDATE users SET password_hash=? WHERE id=?', [bcrypt.hashSync(password, 12), id]);
  res.json({ success: true, data: query('SELECT id, email, name, role, created_at FROM users WHERE id=?', [id])[0] });
});

app.delete('/api/v1/auth/users/:id', authenticate, authorize('admin'), (req, res) => {
  run('DELETE FROM users WHERE id=?', [parseInt(req.params.id!)]); res.json({ success: true });
});

app.get('/api/v1/skills', authenticate, (_r, res) => res.json({ success: true, data: query('SELECT * FROM skills ORDER BY category, name') }));
app.get('/api/v1/skills/:id', authenticate, (req, res) => res.json({ success: true, data: query('SELECT * FROM skills WHERE id=?', [parseInt(req.params.id!)])[0] }));
app.post('/api/v1/skills', authenticate, authorize('admin', 'manager'), (req, res) => {
  const { name, description, category } = req.body;
  const { lastId } = run('INSERT INTO skills (name, description, category) VALUES (?,?,?)', [name, description || '', category]);
  res.status(201).json({ success: true, data: query('SELECT * FROM skills WHERE id=?', [lastId])[0] });
});
app.put('/api/v1/skills/:id', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!); const { name, description, category } = req.body;
  if (name !== undefined) run('UPDATE skills SET name=? WHERE id=?', [name, id]);
  if (description !== undefined) run('UPDATE skills SET description=? WHERE id=?', [description, id]);
  if (category !== undefined) run('UPDATE skills SET category=? WHERE id=?', [category, id]);
  res.json({ success: true, data: query('SELECT * FROM skills WHERE id=?', [id])[0] });
});
app.delete('/api/v1/skills/:id', authenticate, authorize('admin', 'manager'), (req, res) => {
  run('DELETE FROM skills WHERE id=?', [parseInt(req.params.id!)]); res.json({ success: true });
});

app.get('/api/v1/employees', authenticate, (req, res) => {
  let emps = query('SELECT * FROM employees ORDER BY last_name, first_name');
  if (req.query.detailed === 'true') {
    emps = emps.map((e: any) => ({
      ...mapEmployee(e),
      skillRatings: query('SELECT esr.*, s.name as skill_name, s.category as skill_category FROM employee_skill_ratings esr JOIN skills s ON s.id=esr.skill_id WHERE esr.employee_id=?', [e.id]).map(mapSkillRating),
      positionPreferences: query('SELECT epp.*, p.name as position_name FROM employee_position_preferences epp JOIN positions p ON p.id=epp.position_id WHERE epp.employee_id=? ORDER BY epp.rank', [e.id]).map(mapPosPref),
      workLimits: (() => { const w = query('SELECT * FROM work_limits WHERE employee_id=?', [e.id])[0]; return w ? mapWorkLimits(w) : null; })(),
    }));
  } else { emps = emps.map(mapEmployee); }
  res.json({ success: true, data: emps });
});

app.get('/api/v1/employees/:id', authenticate, (req, res) => {
  const e = query('SELECT * FROM employees WHERE id=?', [parseInt(req.params.id!)])[0] as any;
  if (!e) return res.status(404).json({ success: false, error: 'Employe non trouve' });
  if (req.query.detailed === 'true') {
    return res.json({ success: true, data: {
      ...mapEmployee(e),
      skillRatings: query('SELECT esr.*, s.name as skill_name, s.category as skill_category FROM employee_skill_ratings esr JOIN skills s ON s.id=esr.skill_id WHERE esr.employee_id=?', [e.id]).map(mapSkillRating),
      positionPreferences: query('SELECT epp.*, p.name as position_name FROM employee_position_preferences epp JOIN positions p ON p.id=epp.position_id WHERE epp.employee_id=? ORDER BY epp.rank', [e.id]).map(mapPosPref),
      workLimits: (() => { const w = query('SELECT * FROM work_limits WHERE employee_id=?', [e.id])[0]; return w ? mapWorkLimits(w) : null; })(),
    }});
  }
  res.json({ success: true, data: mapEmployee(e) });
});

app.post('/api/v1/employees', authenticate, authorize('admin', 'manager'), (req, res) => {
  const { firstName, lastName, email, phone, hireDate, contractType, status } = req.body;
  const { lastId } = run('INSERT INTO employees (first_name, last_name, email, phone, hire_date, contract_type, status) VALUES (?,?,?,?,?,?,?)', [firstName, lastName, email, phone || '', hireDate, contractType, status || 'actif']);
  res.status(201).json({ success: true, data: mapEmployee(query('SELECT * FROM employees WHERE id=?', [lastId])[0]) });
});

app.put('/api/v1/employees/:id', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!);
  const fields: Record<string, string> = { firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone', hireDate: 'hire_date', contractType: 'contract_type', status: 'status' };
  for (const [k, col] of Object.entries(fields)) { if (req.body[k] !== undefined) run(`UPDATE employees SET ${col}=? WHERE id=?`, [req.body[k], id]); }
  res.json({ success: true, data: mapEmployee(query('SELECT * FROM employees WHERE id=?', [id])[0]) });
});

app.delete('/api/v1/employees/:id', authenticate, authorize('admin'), (req, res) => {
  run('DELETE FROM employees WHERE id=?', [parseInt(req.params.id!)]); res.json({ success: true });
});

app.put('/api/v1/employees/:id/skills', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!);
  run('DELETE FROM employee_skill_ratings WHERE employee_id=?', [id]);
  for (const r of req.body) run('INSERT INTO employee_skill_ratings (employee_id, skill_id, rating) VALUES (?,?,?)', [id, r.skillId, r.rating]);
  res.json({ success: true, data: query('SELECT esr.*, s.name as skill_name, s.category as skill_category FROM employee_skill_ratings esr JOIN skills s ON s.id=esr.skill_id WHERE esr.employee_id=?', [id]).map(mapSkillRating) });
});

app.put('/api/v1/employees/:id/preferences', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!);
  run('DELETE FROM employee_position_preferences WHERE employee_id=?', [id]);
  for (const p of req.body) run('INSERT INTO employee_position_preferences (employee_id, position_id, rank) VALUES (?,?,?)', [id, p.positionId, p.rank]);
  res.json({ success: true, data: query('SELECT * FROM employee_position_preferences WHERE employee_id=?', [id]) });
});

app.put('/api/v1/employees/:id/work-limits', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!);
  const ex = query('SELECT * FROM work_limits WHERE employee_id=?', [id]);
  if (ex.length > 0) run('UPDATE work_limits SET max_hours_per_day=?, max_hours_per_week=?, max_hours_per_month=? WHERE employee_id=?', [req.body.maxHoursPerDay ?? null, req.body.maxHoursPerWeek ?? null, req.body.maxHoursPerMonth ?? null, id]);
  else run('INSERT INTO work_limits (employee_id, max_hours_per_day, max_hours_per_week, max_hours_per_month) VALUES (?,?,?,?)', [id, req.body.maxHoursPerDay ?? null, req.body.maxHoursPerWeek ?? null, req.body.maxHoursPerMonth ?? null]);
  res.json({ success: true, data: mapWorkLimits(query('SELECT * FROM work_limits WHERE employee_id=?', [id])[0]) });
});

app.get('/api/v1/employees/:id/unavailabilities', authenticate, (req, res) => {
  res.json({ success: true, data: query('SELECT * FROM unavailabilities WHERE employee_id=? ORDER BY date', [parseInt(req.params.id!)]).map(mapUnav) });
});

app.post('/api/v1/employees/:id/unavailabilities', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!); const b = req.body;
  const { lastId } = run('INSERT INTO unavailabilities (employee_id, type, date, start_time, end_time, day_of_week, reason, is_recurring) VALUES (?,?,?,?,?,?,?,?)', [id, b.type, b.date || null, b.startTime || null, b.endTime || null, b.dayOfWeek || null, b.reason || '', b.isRecurring ? 1 : 0]);
  res.status(201).json({ success: true, data: mapUnav(query('SELECT * FROM unavailabilities WHERE id=?', [lastId])[0]) });
});

app.delete('/api/v1/employees/:id/unavailabilities/:uid', authenticate, authorize('admin', 'manager'), (req, res) => {
  run('DELETE FROM unavailabilities WHERE id=?', [parseInt(req.params.uid!)]); res.json({ success: true });
});

app.get('/api/v1/positions', authenticate, (req, res) => {
  let positions = query('SELECT * FROM positions ORDER BY name');
  if (req.query.detailed === 'true') {
    positions = positions.map((p: any) => ({ ...mapPosition(p), skillRequirements: query('SELECT psr.*, s.name as skill_name FROM position_skill_requirements psr JOIN skills s ON s.id=psr.skill_id WHERE psr.position_id=? ORDER BY psr.is_required DESC', [p.id]).map(mapPosReq) }));
  } else { positions = positions.map(mapPosition); }
  res.json({ success: true, data: positions });
});

app.get('/api/v1/positions/:id', authenticate, (req, res) => {
  const p = query('SELECT * FROM positions WHERE id=?', [parseInt(req.params.id!)])[0] as any;
  if (!p) return res.status(404).json({ success: false, error: 'Poste non trouve' });
  res.json({ success: true, data: { ...mapPosition(p), skillRequirements: query('SELECT psr.*, s.name as skill_name FROM position_skill_requirements psr JOIN skills s ON s.id=psr.skill_id WHERE psr.position_id=?', [p.id]).map(mapPosReq) } });
});

app.post('/api/v1/positions', authenticate, authorize('admin', 'manager'), (req, res) => {
  const { name, description, color, defaultHeadcount, skillRequirements } = req.body;
  const { lastId } = run('INSERT INTO positions (name, description, color, default_headcount) VALUES (?,?,?,?)', [name, description || '', color || '#3B82F6', defaultHeadcount || 1]);
  if (skillRequirements) for (const r of skillRequirements) run('INSERT INTO position_skill_requirements (position_id, skill_id, minimum_level, is_required) VALUES (?,?,?,?)', [lastId, r.skillId, r.minimumLevel, r.isRequired ? 1 : 0]);
  const p = query('SELECT * FROM positions WHERE id=?', [lastId])[0];
  res.status(201).json({ success: true, data: { ...mapPosition(p), skillRequirements: query('SELECT psr.*, s.name as skill_name FROM position_skill_requirements psr JOIN skills s ON s.id=psr.skill_id WHERE psr.position_id=?', [lastId]).map(mapPosReq) } });
});

app.put('/api/v1/positions/:id', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!); const { name, description, color, defaultHeadcount, skillRequirements } = req.body;
  if (name !== undefined) run('UPDATE positions SET name=? WHERE id=?', [name, id]);
  if (description !== undefined) run('UPDATE positions SET description=? WHERE id=?', [description, id]);
  if (color !== undefined) run('UPDATE positions SET color=? WHERE id=?', [color, id]);
  if (defaultHeadcount !== undefined) run('UPDATE positions SET default_headcount=? WHERE id=?', [defaultHeadcount, id]);
  if (skillRequirements !== undefined) {
    run('DELETE FROM position_skill_requirements WHERE position_id=?', [id]);
    for (const r of skillRequirements) run('INSERT INTO position_skill_requirements (position_id, skill_id, minimum_level, is_required) VALUES (?,?,?,?)', [id, r.skillId, r.minimumLevel, r.isRequired ? 1 : 0]);
  }
  const p = query('SELECT * FROM positions WHERE id=?', [id])[0];
  res.json({ success: true, data: { ...mapPosition(p), skillRequirements: query('SELECT psr.*, s.name as skill_name FROM position_skill_requirements psr JOIN skills s ON s.id=psr.skill_id WHERE psr.position_id=?', [id]).map(mapPosReq) } });
});

app.delete('/api/v1/positions/:id', authenticate, authorize('admin'), (req, res) => {
  run('DELETE FROM positions WHERE id=?', [parseInt(req.params.id!)]); res.json({ success: true });
});

app.get('/api/v1/plannings/dashboard', authenticate, (_r, res) => {
  res.json({ success: true, data: {
    totalEmployees: (query('SELECT COUNT(*) as c FROM employees')[0] as any)?.c || 0,
    activeEmployees: (query("SELECT COUNT(*) as c FROM employees WHERE status='actif'")[0] as any)?.c || 0,
    totalPositions: (query('SELECT COUNT(*) as c FROM positions')[0] as any)?.c || 0,
    totalSkills: (query('SELECT COUNT(*) as c FROM skills')[0] as any)?.c || 0,
    activePlannings: (query("SELECT COUNT(*) as c FROM plannings WHERE status IN ('generated','published')")[0] as any)?.c || 0,
    recentAlerts: [],
  }});
});

app.get('/api/v1/plannings/settings', authenticate, (_r, res) => {
  const s = query('SELECT * FROM establishment_settings WHERE id=1')[0] as any;
  res.json({ success: true, data: { id: 1, defaultMaxHoursPerDay: s.default_max_hours_per_day, defaultMaxHoursPerWeek: s.default_max_hours_per_week, defaultMaxHoursPerMonth: s.default_max_hours_per_month, establishmentName: s.establishment_name, updatedAt: s.updated_at } });
});

app.put('/api/v1/plannings/settings', authenticate, authorize('admin'), (req, res) => {
  const b = req.body;
  if (b.defaultMaxHoursPerDay !== undefined) run('UPDATE establishment_settings SET default_max_hours_per_day=? WHERE id=1', [b.defaultMaxHoursPerDay]);
  if (b.defaultMaxHoursPerWeek !== undefined) run('UPDATE establishment_settings SET default_max_hours_per_week=? WHERE id=1', [b.defaultMaxHoursPerWeek]);
  if (b.defaultMaxHoursPerMonth !== undefined) run('UPDATE establishment_settings SET default_max_hours_per_month=? WHERE id=1', [b.defaultMaxHoursPerMonth]);
  if (b.establishmentName !== undefined) run('UPDATE establishment_settings SET establishment_name=? WHERE id=1', [b.establishmentName]);
  const s = query('SELECT * FROM establishment_settings WHERE id=1')[0] as any;
  res.json({ success: true, data: { id: 1, defaultMaxHoursPerDay: s.default_max_hours_per_day, defaultMaxHoursPerWeek: s.default_max_hours_per_week, defaultMaxHoursPerMonth: s.default_max_hours_per_month, establishmentName: s.establishment_name, updatedAt: s.updated_at } });
});

app.get('/api/v1/plannings', authenticate, (_r, res) => {
  res.json({ success: true, data: query('SELECT * FROM plannings ORDER BY created_at DESC').map(mapPlanning) });
});

app.get('/api/v1/plannings/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id!);
  const p = query('SELECT * FROM plannings WHERE id=?', [id])[0];
  if (!p) return res.status(404).json({ success: false, error: 'Planning non trouve' });
  const requirements = query('SELECT sr.*, p.name as position_name, p.color as position_color FROM slot_requirements sr JOIN positions p ON p.id=sr.position_id WHERE sr.planning_id=? ORDER BY sr.date, sr.start_time', [id]).map(mapSlot);
  const assignments = query("SELECT a.*, e.first_name||' '||e.last_name as employee_name, p.name as position_name, p.color as position_color, sr.date, sr.start_time, sr.end_time FROM assignments a JOIN employees e ON e.id=a.employee_id JOIN slot_requirements sr ON sr.id=a.slot_requirement_id JOIN positions p ON p.id=sr.position_id WHERE a.planning_id=? ORDER BY sr.date, sr.start_time", [id]).map(mapAssignment);
  res.json({ success: true, data: { ...mapPlanning(p), requirements, assignments, alerts: [] } });
});

app.post('/api/v1/plannings', authenticate, authorize('admin', 'manager'), (req, res) => {
  const { startDate, endDate, requirements, seed } = req.body;
  const { lastId } = run("INSERT INTO plannings (start_date, end_date, status, seed) VALUES (?,?,'draft',?)", [startDate, endDate, seed || 42]);
  for (const r of requirements) run('INSERT INTO slot_requirements (planning_id, position_id, date, start_time, end_time, headcount) VALUES (?,?,?,?,?,?)', [lastId, r.positionId, r.date, r.startTime, r.endTime, r.headcount]);
  const p = query('SELECT * FROM plannings WHERE id=?', [lastId])[0];
  const reqs = query('SELECT sr.*, p.name as position_name, p.color as position_color FROM slot_requirements sr JOIN positions p ON p.id=sr.position_id WHERE sr.planning_id=?', [lastId]).map(mapSlot);
  res.status(201).json({ success: true, data: { ...mapPlanning(p), requirements: reqs, assignments: [], alerts: [] } });
});

app.put('/api/v1/plannings/:id', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!);
  if (req.body.startDate) run('UPDATE plannings SET start_date=? WHERE id=?', [req.body.startDate, id]);
  if (req.body.endDate) run('UPDATE plannings SET end_date=? WHERE id=?', [req.body.endDate, id]);
  if (req.body.seed) run('UPDATE plannings SET seed=? WHERE id=?', [req.body.seed, id]);
  res.json({ success: true, data: mapPlanning(query('SELECT * FROM plannings WHERE id=?', [id])[0]) });
});

app.post('/api/v1/plannings/:id/requirements', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!); const { positionId, date, startTime, endTime, headcount } = req.body;
  const { lastId } = run('INSERT INTO slot_requirements (planning_id, position_id, date, start_time, end_time, headcount) VALUES (?,?,?,?,?,?)', [id, positionId, date, startTime, endTime, headcount]);
  run("UPDATE plannings SET status='draft' WHERE id=?", [id]);
  res.status(201).json({ success: true, data: mapSlot(query('SELECT sr.*, p.name as position_name, p.color as position_color FROM slot_requirements sr JOIN positions p ON p.id=sr.position_id WHERE sr.id=?', [lastId])[0]) });
});

app.post('/api/v1/plannings/:id/requirements/bulk', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!); const slots: any[] = [];
  for (const r of req.body) {
    const { lastId } = run('INSERT INTO slot_requirements (planning_id, position_id, date, start_time, end_time, headcount) VALUES (?,?,?,?,?,?)', [id, r.positionId, r.date, r.startTime, r.endTime, r.headcount]);
    slots.push(mapSlot(query('SELECT sr.*, p.name as position_name, p.color as position_color FROM slot_requirements sr JOIN positions p ON p.id=sr.position_id WHERE sr.id=?', [lastId])[0]));
  }
  run("UPDATE plannings SET status='draft' WHERE id=?", [id]);
  res.status(201).json({ success: true, data: slots });
});

app.put('/api/v1/plannings/:id/requirements/:reqId', authenticate, authorize('admin', 'manager'), (req, res) => {
  const planningId = parseInt(req.params.id!); const reqId = parseInt(req.params.reqId!); const b = req.body;
  if (b.positionId !== undefined) run('UPDATE slot_requirements SET position_id=? WHERE id=?', [b.positionId, reqId]);
  if (b.date !== undefined) run('UPDATE slot_requirements SET date=? WHERE id=?', [b.date, reqId]);
  if (b.startTime !== undefined) run('UPDATE slot_requirements SET start_time=? WHERE id=?', [b.startTime, reqId]);
  if (b.endTime !== undefined) run('UPDATE slot_requirements SET end_time=? WHERE id=?', [b.endTime, reqId]);
  if (b.headcount !== undefined) run('UPDATE slot_requirements SET headcount=? WHERE id=?', [b.headcount, reqId]);
  run("UPDATE plannings SET status='draft' WHERE id=?", [planningId]);
  res.json({ success: true, data: mapSlot(query('SELECT sr.*, p.name as position_name, p.color as position_color FROM slot_requirements sr JOIN positions p ON p.id=sr.position_id WHERE sr.id=?', [reqId])[0]) });
});

app.delete('/api/v1/plannings/:id/requirements/:reqId', authenticate, authorize('admin', 'manager'), (req, res) => {
  const planningId = parseInt(req.params.id!); const reqId = parseInt(req.params.reqId!);
  run('DELETE FROM assignments WHERE slot_requirement_id=? AND planning_id=?', [reqId, planningId]);
  run('DELETE FROM slot_requirements WHERE id=? AND planning_id=?', [reqId, planningId]);
  run("UPDATE plannings SET status='draft' WHERE id=?", [planningId]);
  res.json({ success: true });
});

app.post('/api/v1/plannings/:id/generate', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!);
  run('DELETE FROM assignments WHERE planning_id=? AND is_manual=0', [id]);
  const employees = query("SELECT * FROM employees WHERE status='actif'");
  const assigned = new Set<string>();
  let totalAssigned = 0;
  const totalNeeded = (query('SELECT SUM(headcount) as t FROM slot_requirements WHERE planning_id=?', [id])[0] as any)?.t || 0;
  const allSlots = query('SELECT * FROM slot_requirements WHERE planning_id=? ORDER BY date, start_time', [id]);
  for (const slot of allSlots) {
    const s = slot as any;
    for (let i = 0; i < s.headcount; i++) {
      for (const emp of employees) {
        const e = emp as any;
        const key = s.id + '-' + e.id;
        const dayKey = e.id + '-' + s.date + '-' + s.start_time;
        if (assigned.has(key) || assigned.has(dayKey)) continue;
        run('INSERT INTO assignments (planning_id, slot_requirement_id, employee_id, is_manual, is_forced, warnings) VALUES (?,?,?,0,0,?)', [id, s.id, e.id, '[]']);
        assigned.add(key); assigned.add(dayKey); totalAssigned++; break;
      }
    }
  }
  const coverage = totalNeeded > 0 ? (totalAssigned / totalNeeded) * 100 : 100;
  const score = coverage * 0.7 + 21;
  run("UPDATE plannings SET status='generated', quality_score=?, coverage_score=?, adequacy_score=70, equity_score=70, updated_at=datetime('now') WHERE id=?", [score, coverage, id]);
  const p = query('SELECT * FROM plannings WHERE id=?', [id])[0];
  const requirements = query('SELECT sr.*, p.name as position_name, p.color as position_color FROM slot_requirements sr JOIN positions p ON p.id=sr.position_id WHERE sr.planning_id=? ORDER BY sr.date', [id]).map(mapSlot);
  const assignments2 = query("SELECT a.*, e.first_name||' '||e.last_name as employee_name, p.name as position_name, p.color as position_color, sr.date, sr.start_time, sr.end_time FROM assignments a JOIN employees e ON e.id=a.employee_id JOIN slot_requirements sr ON sr.id=a.slot_requirement_id JOIN positions p ON p.id=sr.position_id WHERE a.planning_id=?", [id]).map(mapAssignment);
  res.json({ success: true, data: { planning: { ...mapPlanning(p), requirements, assignments: assignments2, alerts: [] }, report: { overallScore: score, coverageScore: coverage, adequacyScore: 70, equityScore: 70, totalSlots: totalNeeded, coveredSlots: totalAssigned, uncoveredSlots: totalNeeded - totalAssigned, averageSkillMatch: 0.7, hoursDistribution: [], alerts: [] } } });
});

app.post('/api/v1/plannings/:id/publish', authenticate, authorize('admin', 'manager'), (req, res) => {
  run("UPDATE plannings SET status='published' WHERE id=?", [parseInt(req.params.id!)]);
  res.json({ success: true, data: mapPlanning(query('SELECT * FROM plannings WHERE id=?', [parseInt(req.params.id!)])[0]) });
});

app.post('/api/v1/plannings/:id/assignments', authenticate, authorize('admin', 'manager'), (req, res) => {
  const id = parseInt(req.params.id!); const { slotRequirementId, employeeId, force } = req.body;
  const { lastId } = run('INSERT INTO assignments (planning_id, slot_requirement_id, employee_id, is_manual, is_forced, warnings) VALUES (?,?,?,1,?,?)', [id, slotRequirementId, employeeId, force ? 1 : 0, '[]']);
  const a = query("SELECT a.*, e.first_name||' '||e.last_name as employee_name, p.name as position_name, p.color as position_color, sr.date, sr.start_time, sr.end_time FROM assignments a JOIN employees e ON e.id=a.employee_id JOIN slot_requirements sr ON sr.id=a.slot_requirement_id JOIN positions p ON p.id=sr.position_id WHERE a.id=?", [lastId])[0];
  res.status(201).json({ success: true, data: mapAssignment(a) });
});

app.delete('/api/v1/plannings/:id/assignments/:aid', authenticate, authorize('admin', 'manager'), (req, res) => {
  run('DELETE FROM assignments WHERE id=? AND planning_id=?', [parseInt(req.params.aid!), parseInt(req.params.id!)]); res.json({ success: true });
});

app.delete('/api/v1/plannings/:id', authenticate, authorize('admin'), (req, res) => {
  run('DELETE FROM plannings WHERE id=?', [parseInt(req.params.id!)]); res.json({ success: true });
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Route non trouvee: ' + req.method + ' ' + req.path }));

function mapEmployee(e: any) { return { id: e.id, firstName: e.first_name, lastName: e.last_name, email: e.email, phone: e.phone, hireDate: e.hire_date, contractType: e.contract_type, status: e.status, photo: e.photo || '', createdAt: e.created_at, updatedAt: e.updated_at }; }
function mapSkillRating(r: any) { return { id: r.id, employeeId: r.employee_id, skillId: r.skill_id, rating: r.rating, skillName: r.skill_name, skillCategory: r.skill_category }; }
function mapPosPref(p: any) { return { id: p.id, employeeId: p.employee_id, positionId: p.position_id, rank: p.rank, positionName: p.position_name }; }
function mapWorkLimits(w: any) { return { id: w.id, employeeId: w.employee_id, maxHoursPerDay: w.max_hours_per_day, maxHoursPerWeek: w.max_hours_per_week, maxHoursPerMonth: w.max_hours_per_month }; }
function mapUnav(u: any) { return { id: u.id, employeeId: u.employee_id, type: u.type, date: u.date, startTime: u.start_time, endTime: u.end_time, dayOfWeek: u.day_of_week, reason: u.reason, isRecurring: u.is_recurring === 1, createdAt: u.created_at }; }
function mapPosition(p: any) { return { id: p.id, name: p.name, description: p.description, color: p.color, defaultHeadcount: p.default_headcount, createdAt: p.created_at, updatedAt: p.updated_at }; }
function mapPosReq(r: any) { return { id: r.id, positionId: r.position_id, skillId: r.skill_id, minimumLevel: r.minimum_level, isRequired: r.is_required === 1, skillName: r.skill_name }; }
function mapPlanning(p: any) { return { id: p.id, startDate: p.start_date, endDate: p.end_date, status: p.status, qualityScore: p.quality_score, coverageScore: p.coverage_score, adequacyScore: p.adequacy_score, equityScore: p.equity_score, seed: p.seed, createdAt: p.created_at, updatedAt: p.updated_at }; }
function mapSlot(s: any) { return { id: s.id, planningId: s.planning_id, positionId: s.position_id, date: s.date, startTime: s.start_time, endTime: s.end_time, headcount: s.headcount, positionName: s.position_name, positionColor: s.position_color }; }
function mapAssignment(a: any) { return { id: a.id, planningId: a.planning_id, slotRequirementId: a.slot_requirement_id, employeeId: a.employee_id, isManual: a.is_manual === 1, isForced: a.is_forced === 1, warnings: JSON.parse(a.warnings || '[]'), employeeName: a.employee_name, positionName: a.position_name, positionColor: a.position_color, date: a.date, startTime: a.start_time, endTime: a.end_time }; }

let ready = false;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!ready) {
    try {
      const SQL = await initSqlJs();
      db = new SQL.Database();
      exec('PRAGMA foreign_keys = ON');
      runMigrations();
      ensureAdmin();
      ready = true;
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Init failed: ' + err.message });
    }
  }
  return app(req as any, res as any);
}
