# PeopleOS — Employee Management System

Full-stack employee directory built with React + Vite, Express, and PostgreSQL.

## Features
- Administrator login/logout using bcrypt password hashes and PostgreSQL-backed server sessions.
- Protected employee CRUD API; unique employee code and email.
- Search, department/status filters, pagination, dashboard metrics.
- CSV export with spreadsheet formula-injection mitigation.
- Responsive dashboard, employee form, confirmation dialog, keyboard search shortcut.
- PostgreSQL schema, indexes, Docker Compose, admin seed and optional sample-data seed.

## Requirements
Node.js 20.19+ or 22.12+, npm 10+, Docker Desktop (or PostgreSQL 14+).

## Run locally
1. Extract the ZIP and open a terminal in this folder.
2. `npm install`
3. Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`).
4. `docker compose up -d`
5. `npm run db:migrate`
6. `npm run db:seed`
7. `npm run dev`
8. Open http://localhost:5173

Demo admin: `admin@peopleos.local` / `ChangeMe123!`. Change `ADMIN_PASSWORD` in `.env` before seeding if desired; never use this default in production.

Optional sample employee data: `npm run db:seed-sample -w server`.

## Commands
- `npm run dev` — frontend and API
- `npm run build` — production frontend build
- `npm run db:migrate` — apply schema
- `npm run db:seed` — create/update admin
- `npm run db:seed-sample -w server` — insert demo employees
- `npm run start` — start API

## API
- `GET /health`
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET/POST /api/employees`, `GET/PUT/DELETE /api/employees/:id`
- `GET /api/dashboard/stats`

Employee list supports `page`, `limit` (max 50), `search`, `department`, and `status`.

## Security and limitations
Passwords are bcrypt-hashed; session IDs are stored in PostgreSQL; cookies are HttpOnly, SameSite=Lax and Secure in production. Login is rate-limited. Helmet headers, Zod validation, parameterized SQL, unique/check constraints, and server-side access checks are included.

This is a local-development foundation, not a security audit or turnkey production deployment. Before production: configure strong secrets and HTTPS, set exact trusted origins, review CSRF protections for your deployment topology, configure backups/monitoring, add automated integration tests, and review employee-data privacy/legal obligations. The app has a single administrator role; no public registration, employee self-service, payroll, attendance, leave workflow, or multi-tenant support. Salary is displayed in INR.

## Structure
`client/` React UI · `server/` Express API · `database/migrations/` SQL schema · `docker-compose.yml` PostgreSQL.
