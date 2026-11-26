import app from './app.js';
import { env } from './config.js';
import { pool } from './db.js';

let server;
let shuttingDown = false;

async function start() {
  await pool.query('SELECT 1');
  server = app.listen(env.port, () => console.log(`PeopleOS API listening on port ${env.port}`));
}

async function stop(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: shutting down`);
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  clearTimeout(timeout);
}

process.on('SIGINT', () => { stop('SIGINT').then(() => process.exit(0)); });
process.on('SIGTERM', () => { stop('SIGTERM').then(() => process.exit(0)); });
start().catch((error) => {
  console.error('PeopleOS startup failed:', error.code || error.name || 'Error');
  process.exitCode = 1;
  pool.end().finally(() => process.exit());
});
