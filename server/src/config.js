import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const production = process.env.NODE_ENV === 'production';
const required = (key) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};
const isPlaceholder = (value) => /^(replace|change|your|example|test)[-_ ]/i.test(value) || ['change_me', 'changeme', 'password', 'secret', 'changeme123!'].includes(value.toLowerCase());

const databaseUrl = required('DATABASE_URL');
try {
  if (!['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol)) throw new Error();
} catch {
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
}
const secret = required('SESSION_SECRET');
if (secret.length < 32 || isPlaceholder(secret)) {
  throw new Error('SESSION_SECRET must be a unique random value of at least 32 characters.');
}

const origins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
for (const origin of origins) {
  let parsed;
  try { parsed = new URL(origin); } catch { throw new Error('CLIENT_ORIGINS must contain valid origins.'); }
  if (parsed.origin !== origin || (production && parsed.protocol !== 'https:')) {
    throw new Error('CLIENT_ORIGINS must contain exact origins (HTTPS in production).');
  }
}

const adminPassword = process.env.ADMIN_PASSWORD?.trim() || '';
const passwordClasses = [/[a-z]/.test(adminPassword), /[A-Z]/.test(adminPassword), /\d/.test(adminPassword), /[^A-Za-z0-9]/.test(adminPassword)].filter(Boolean).length;
if (production && (adminPassword.length < 16 || passwordClasses < 3 || isPlaceholder(adminPassword))) {
  throw new Error('Production requires an explicitly configured ADMIN_PASSWORD of at least 16 characters.');
}
if (production && process.env.DB_SSL !== 'true') throw new Error('DB_SSL=true is required in production.');
if (production && origins.some((origin) => new URL(origin).hostname === 'localhost')) {
  throw new Error('Production CLIENT_ORIGINS cannot use localhost.');
}

const sameSite = (process.env.SESSION_SAME_SITE || 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(sameSite)) throw new Error('SESSION_SAME_SITE must be lax, strict, or none.');
if (sameSite === 'none' && !production) throw new Error('SESSION_SAME_SITE=none requires production HTTPS.');
if (production && sameSite === 'none' && process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'true') {
  throw new Error('Cross-site cookies require secure production configuration.');
}
const trustProxy = Number(process.env.TRUST_PROXY_HOPS || 1);
if (!Number.isSafeInteger(trustProxy) || trustProxy < 0) throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS || 8 * 60 * 60 * 1000);
if (!Number.isSafeInteger(sessionMaxAgeMs) || sessionMaxAgeMs < 60_000) throw new Error('SESSION_MAX_AGE_MS must be at least 60000.');
if (production && (!process.env.ADMIN_EMAIL?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ADMIN_EMAIL.trim()))) {
  throw new Error('Production requires a valid ADMIN_EMAIL for administrator setup.');
}

export const env = {
  port: Number(process.env.PORT || 4000), origins, secret, production,
  databaseUrl, ssl: process.env.DB_SSL === 'true',
  cookieSameSite: sameSite,
  trustProxy,
  sessionMaxAgeMs,
  adminName: process.env.ADMIN_NAME || 'PeopleOS Administrator',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword,
};
