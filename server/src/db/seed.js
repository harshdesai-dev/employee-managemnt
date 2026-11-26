import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../config.js';
import { pool } from '../db.js';

const rotateExisting = process.argv.includes('--rotate-password');
try {
  const admin = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    password: z.string().min(env.production ? 16 : 12).max(128)
      .refine((value) => !/^(replace|change|your|example|test)[-_ ]/i.test(value) && value.toLowerCase() !== 'changeme123!', 'Choose a unique administrator password; example passwords are not allowed.')
      .refine((value) => !env.production || [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length >= 3, 'Production administrator password must use at least three character types.'),
  }).parse({ name: env.adminName, email: env.adminEmail, password: env.adminPassword });
  const hash = await bcrypt.hash(admin.password, 12);
  const result = await pool.query(
    `INSERT INTO users(name,email,password_hash) VALUES($1,LOWER($2),$3) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,updated_at=NOW() WHERE $4::boolean RETURNING id`,
    [admin.name, admin.email, hash, rotateExisting],
  );
  console.log(result.rowCount ? (rotateExisting ? 'Administrator password rotated.' : 'Administrator account created.') : 'Administrator already exists; existing credentials were preserved.');
} catch (error) {
  console.error('Seed failed:', error.code || error.name || 'Error');
  process.exitCode = 1;
} finally {
  await pool.end();
}
