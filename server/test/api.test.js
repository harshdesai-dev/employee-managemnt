import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
process.env.SESSION_SECRET = 'unit-session-secret-that-is-long-enough-123456';
process.env.CLIENT_ORIGINS = 'http://localhost:5173';

const { createApp } = await import('../src/app.js');
const origin = 'http://localhost:5173';
const employee = (overrides = {}) => ({
  employee_code: 'EMP-001', full_name: 'Aarav Mehta', email: 'aarav@example.com',
  phone: '+91 98765 43210', department: 'Engineering', designation: 'Engineer',
  salary: 1250000.25, joining_date: '2024-02-29', status: 'Active', ...overrides,
});

class MemoryStore extends session.Store {
  records = new Map();
  get(id, callback) { callback(null, this.records.get(id)); }
  set(id, value, callback) { this.records.set(id, value); callback?.(null); }
  destroy(id, callback) { this.records.delete(id); callback?.(null); }
  touch(id, value, callback) { this.set(id, value, callback); }
}

class FakeDb {
  users = [];
  employees = [];
  fail = false;
  async query(sql, values = []) {
    if (this.fail) { const error = new Error('private database detail'); error.code = 'ECONNREFUSED'; throw error; }
    if (sql.includes('FROM users WHERE email')) return { rows: this.users.filter((user) => user.email === values[0]), rowCount: 1 };
    if (sql.startsWith('SELECT COUNT(*)::int total,COUNT(*)')) return { rows: [{ total: this.employees.length, active: this.employees.filter((e) => e.status === 'Active').length, on_leave: 0, inactive: 0, departments: 1 }], rowCount: 1 };
    if (sql.startsWith('SELECT department,COUNT(*)')) return { rows: [], rowCount: 0 };
    if (sql.startsWith('SELECT COUNT(*)::int total FROM employees')) return { rows: [{ total: this.filter(sql, values).length }], rowCount: 1 };
    if (sql.startsWith('SELECT id,employee_code')) {
      if (sql.includes('WHERE id=$1')) { const row = this.employees.find((e) => e.id === values[0]); return { rows: row ? [row] : [], rowCount: row ? 1 : 0 }; }
      const filtered = this.filter(sql, values);
      const limit = values.at(-2); const offset = values.at(-1);
      return { rows: filtered.slice(offset, offset + limit), rowCount: Math.min(limit, Math.max(0, filtered.length - offset)) };
    }
    if (sql.startsWith('INSERT INTO employees')) {
      if (this.employees.some((e) => e.employee_code === values[0] || e.email === values[2])) { const error = new Error('duplicate'); error.code = '23505'; throw error; }
      const row = Object.fromEntries(['employee_code','full_name','email','phone','department','designation','salary','joining_date','status'].map((key, index) => [key, String(values[index])]));
      row.id = this.employees.length + 1; this.employees.push(row); return { rows: [row], rowCount: 1 };
    }
    if (sql.startsWith('UPDATE employees')) {
      const row = this.employees.find((e) => e.id === values[9]); if (!row) return { rows: [], rowCount: 0 };
      ['employee_code','full_name','email','phone','department','designation','salary','joining_date','status'].forEach((key, index) => { row[key] = String(values[index]); });
      return { rows: [row], rowCount: 1 };
    }
    if (sql.startsWith('DELETE FROM employees')) { const n = this.employees.length; this.employees = this.employees.filter((e) => e.id !== values[0]); return { rows: [], rowCount: n - this.employees.length }; }
    return { rows: [], rowCount: 0 };
  }
  filter(sql, values) {
    let rows = [...this.employees]; let i = 0;
    if (sql.includes('ILIKE')) { const term = values[i++].replaceAll('%', '').replaceAll('\\', '').toLowerCase(); rows = rows.filter((e) => `${e.full_name} ${e.email} ${e.employee_code}`.toLowerCase().includes(term)); }
    if (sql.includes('department=$')) { const department = values[i++]; rows = rows.filter((e) => e.department === department); }
    if (sql.includes('status=$')) { const status = values[i++]; rows = rows.filter((e) => e.status === status); }
    return rows;
  }
}

let db, server, baseUrl, cookie;
async function request(path, { method = 'GET', body, withOrigin = true } = {}) {
  const headers = { ...(withOrigin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) };
  const response = await fetch(`${baseUrl}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0];
  return { response, data: response.status === 204 ? null : await response.json() };
}

before(async () => {
  db = new FakeDb();
  db.users.push({ id: 1, name: 'Admin', email: 'admin@example.test', role: 'admin', password_hash: await bcrypt.hash('correct horse battery staple', 4) });
  const app = createApp({ db, settings: { production: false, origins: [origin], secret: process.env.SESSION_SECRET, cookieSameSite: 'lax' }, sessionStore: new MemoryStore() });
  server = app.listen(0); await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => { cookie = undefined; db.fail = false; db.employees = []; });

test('protects employee data, logs in, regenerates session, and logs out', async () => {
  assert.equal((await request('/api/employees')).response.status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'wrong' } })).response.status, 401);
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'ADMIN@example.test', password: 'correct horse battery staple' } });
  assert.equal(login.response.status, 200); assert.equal(login.data.user.email, 'admin@example.test');
  assert.match(login.response.headers.get('set-cookie') || '', /HttpOnly/i);
  assert.match(login.response.headers.get('set-cookie') || '', /SameSite=Lax/i);
  assert.equal((await request('/api/auth/me')).response.status, 200);
  assert.equal((await request('/api/auth/logout', { method: 'POST' })).response.status, 204);
  assert.equal((await request('/api/auth/me')).response.status, 401);
});

test('rejects writes without a trusted Origin', async () => {
  cookie = undefined;
  await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'correct horse battery staple' } });
  assert.equal((await request('/api/employees', { method: 'POST', body: employee(), withOrigin: false })).response.status, 403);
});

test('validates dates and salary, creates, searches, paginates, updates, and deletes employees', async () => {
  await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'correct horse battery staple' } });
  assert.equal((await request('/api/employees', { method: 'POST', body: employee({ joining_date: '2024-02-30' }) })).response.status, 400);
  assert.equal((await request('/api/employees', { method: 'POST', body: employee({ salary: 12.345 }) })).response.status, 400);
  assert.equal((await request('/api/employees', { method: 'POST', body: employee() })).response.status, 201);
  assert.equal((await request('/api/employees', { method: 'POST', body: employee() })).response.status, 409);
  assert.equal((await request('/api/employees', { method: 'POST', body: employee({ employee_code: 'EMP-002', full_name: 'Aarav Other' }) })).response.status, 409);
  assert.equal((await request('/api/employees', { method: 'POST', body: employee({ employee_code: 'EMP-002', email: 'other@example.com', full_name: 'Mira Das', department: 'Design' }) })).response.status, 201);
  assert.equal((await request('/api/employees?search=Aarav&department=Engineering&status=Active')).data.pagination.total, 1);
  const firstPage = await request('/api/employees?limit=1&page=1');
  assert.equal(firstPage.data.pagination.pages, 2);
  assert.equal((await request('/api/employees?limit=1&page=2')).data.employees.length, 1);
  assert.equal((await request('/api/employees?limit=500')).response.status, 400);
  assert.equal((await request('/api/employees?page=100001')).response.status, 400);
  assert.equal((await request('/api/employees?status=Other')).response.status, 400);
  assert.equal((await request('/api/employees/1', { method: 'PUT', body: employee({ status: 'Inactive' }) })).response.status, 200);
  assert.equal((await request('/api/employees/1', { method: 'DELETE' })).response.status, 204);
  assert.equal((await request('/api/employees/1')).response.status, 404);
});

test('returns safe server errors when the database fails', async () => {
  await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'correct horse battery staple' } });
  db.fail = true;
  const result = await request('/api/employees');
  assert.equal(result.response.status, 503);
  assert.equal(result.data.error, 'The database is temporarily unavailable.');
  assert.equal(JSON.stringify(result.data).includes('private database detail'), false);
});
