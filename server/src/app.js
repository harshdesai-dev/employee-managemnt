import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';
import { env } from './config.js';
import { loginSchema, employeeSchema } from './validation.js';

const PgStore = connectPgSimple(session);
const employeeFields = `id,employee_code,full_name,email,phone,department,designation,salary::text AS salary,TO_CHAR(joining_date,'YYYY-MM-DD') AS joining_date,status,created_at,updated_at`;
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const validationMessage = (result) => result.error.issues[0]?.message || 'Invalid input.';

export function createApp({ db = pool, settings = env, sessionStore } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (settings.production) app.set('trust proxy', settings.trustProxy ?? 1);
  app.use(helmet());
  app.use(cors({ origin(origin, callback) {
    return callback(null, !origin || settings.origins.includes(origin));
  }, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(session({
    name: 'peopleos.sid',
    store: sessionStore || new PgStore({ pool: db, tableName: 'user_sessions', createTableIfMissing: false }),
    secret: settings.secret, resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, sameSite: settings.cookieSameSite || 'lax', secure: settings.production, maxAge: settings.sessionMaxAgeMs || 8 * 60 * 60 * 1000 },
  }));

  // Cookie-authenticated write requests must carry an allowed browser Origin.
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (!req.headers.origin || !settings.origins.includes(req.headers.origin)) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    return next();
  });
  const auth = (req, res, next) => req.session?.user ? next() : res.status(401).json({ error: 'Authentication required.' });
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many login attempts. Try again in 15 minutes.' } });

  app.get('/health', asyncRoute(async (req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  }));
  app.post('/api/auth/login', loginLimit, asyncRoute(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
    const result = await db.query('SELECT id,name,email,password_hash,role FROM users WHERE email=$1', [parsed.data.email]);
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(parsed.data.password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password.' });
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ user: req.session.user });
  }));
  app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.session.user }));
  app.post('/api/auth/logout', auth, (req, res, next) => req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('peopleos.sid', { path: '/', httpOnly: true, sameSite: settings.cookieSameSite || 'lax', secure: settings.production });
    return res.status(204).end();
  }));

  app.get('/api/dashboard/stats', auth, asyncRoute(async (req, res) => {
    const totals = await db.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='Active')::int active,COUNT(*) FILTER(WHERE status='On Leave')::int on_leave,COUNT(*) FILTER(WHERE status='Inactive')::int inactive,COUNT(DISTINCT department)::int departments FROM employees`);
    const departments = await db.query('SELECT department,COUNT(*)::int count FROM employees GROUP BY department ORDER BY count DESC,department');
    res.json({ ...totals.rows[0], departments: departments.rows });
  }));

  app.get('/api/employees', auth, asyncRoute(async (req, res) => {
    const queryInt = (key, fallback, maximum) => {
      const raw = req.query[key];
      if (raw === undefined) return fallback;
      if (!/^\d+$/.test(String(raw))) return null;
      const number = Number(raw);
      return Number.isSafeInteger(number) && number >= 1 && number <= maximum ? number : null;
    };
    const page = queryInt('page', 1, 100_000);
    const limit = queryInt('limit', 10, 50);
    if (!page || !limit || !Number.isSafeInteger((page - 1) * limit)) return res.status(400).json({ error: 'Page must be between 1 and 100000 and limit between 1 and 50.' });
    const search = String(req.query.search || '').trim().slice(0, 100);
    const department = String(req.query.department || '').trim().slice(0, 80);
    const status = String(req.query.status || '');
    if (status && !['Active', 'On Leave', 'Inactive'].includes(status)) return res.status(400).json({ error: 'Status must be Active, On Leave, or Inactive.' });
    const clauses = []; const values = [];
    if (search) { values.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`); clauses.push(`(full_name ILIKE $${values.length} ESCAPE '\\' OR email ILIKE $${values.length} ESCAPE '\\' OR employee_code ILIKE $${values.length} ESCAPE '\\')`); }
    if (department) { values.push(department); clauses.push(`department=$${values.length}`); }
    if (status) { values.push(status); clauses.push(`status=$${values.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await db.query(`SELECT COUNT(*)::int total FROM employees ${where}`, values);
    if (page > Math.max(1, Math.ceil(count.rows[0].total / limit))) return res.status(400).json({ error: 'Page is outside the available result range.' });
    const dataValues = [...values, limit, (page - 1) * limit];
    const data = await db.query(`SELECT ${employeeFields} FROM employees ${where} ORDER BY created_at DESC,id DESC LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`, dataValues);
    res.json({ employees: data.rows, pagination: { page, limit, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) } });
  }));

  app.get('/api/employees/:id', auth, asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid employee ID.' });
    const result = await db.query(`SELECT ${employeeFields} FROM employees WHERE id=$1`, [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Employee not found.' });
    res.json({ employee: result.rows[0] });
  }));
  app.post('/api/employees', auth, asyncRoute(async (req, res) => {
    const parsed = employeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed) });
    const employee = parsed.data;
    try {
      const result = await db.query(`INSERT INTO employees(employee_code,full_name,email,phone,department,designation,salary,joining_date,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${employeeFields}`,
        [employee.employee_code, employee.full_name, employee.email, employee.phone, employee.department, employee.designation, employee.salary, employee.joining_date, employee.status]);
      res.status(201).json({ employee: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Employee code or email already exists.' });
      throw error;
    }
  }));
  app.put('/api/employees/:id', auth, asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid employee ID.' });
    const parsed = employeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed) });
    const employee = parsed.data;
    try {
      const result = await db.query(`UPDATE employees SET employee_code=$1,full_name=$2,email=$3,phone=$4,department=$5,designation=$6,salary=$7,joining_date=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING ${employeeFields}`,
        [employee.employee_code, employee.full_name, employee.email, employee.phone, employee.department, employee.designation, employee.salary, employee.joining_date, employee.status, id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Employee not found.' });
      res.json({ employee: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Employee code or email already exists.' });
      throw error;
    }
  }));
  app.delete('/api/employees/:id', auth, asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid employee ID.' });
    const result = await db.query('DELETE FROM employees WHERE id=$1', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Employee not found.' });
    res.status(204).end();
  }));

  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    console.error('Request failed:', error.code || error.name || 'Error');
    if (res.headersSent) return next(error);
    const databaseUnavailable = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code?.startsWith('08') || ['53300', '57P01', '57P02', '57P03'].includes(error.code);
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : error.code === '23505' ? 409 : error.code === '23503' || error.code === '23514' ? 400 : databaseUnavailable ? 503 : 500;
    const errorMessage = status === 413 ? 'Request body is too large.' : status === 400 ? 'Request body must contain valid JSON.' : status === 409 ? 'The request conflicts with existing data.' : status === 503 ? 'The database is temporarily unavailable.' : 'An unexpected server error occurred.';
    return res.status(status).json({ error: errorMessage });
  });
  return app;
}

export default createApp();
