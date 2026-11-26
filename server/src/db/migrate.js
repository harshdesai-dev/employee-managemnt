import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../database/migrations');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('peopleos:migrations'))");
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  for (const name of (await fs.readdir(directory)).filter((item) => item.endsWith('.sql')).sort()) {
    const sql = await fs.readFile(path.join(directory, name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
    if (previous.rowCount) {
      if (previous.rows[0].checksum.trim() !== checksum) throw new Error(`Applied migration ${name} was edited. Add a new migration instead.`);
      continue;
    }
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
    console.log(`Applied ${name}`);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migration failed:', error.code || error.name || 'Error');
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
