# PeopleOS — Employee Management System

PeopleOS is an employee directory with administrator sign-in, protected employee management, search, filtering, pagination, dashboard metrics, and CSV export.

## Technology stack

- React 18 and Vite
- Node.js 20.19+ or 22.12+, Express 4
- PostgreSQL 14+ using `pg`
- PostgreSQL-backed sessions and bcrypt password hashing
- Docker Compose for a local PostgreSQL instance

## Prerequisites

Install Node.js and npm, plus Docker Desktop or a PostgreSQL server. The repository uses npm workspaces and the root `package-lock.json`; run installs from the repository root. A clean checkout should run `npm ci`.

## Local development

1. Copy `.env.example` to `.env`, replace the local database password in both `DATABASE_URL` and `POSTGRES_PASSWORD`, and replace the session secret. Generate a session secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
2. Start local PostgreSQL with `docker compose up -d` (or configure `DATABASE_URL` for your local PostgreSQL instance).
3. Install packages: `npm ci`.
4. Apply migrations: `npm run db:migrate`.
5. Set `ADMIN_NAME`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 12 characters in `.env`, then run `npm run db:seed`.
6. Start the frontend and API: `npm run dev`.
7. Open <http://localhost:5173> and sign in with the admin credentials you configured.

No public or prefilled administrator credentials are provided. The seed command creates an account only when that email is new; it never changes the password of an existing administrator. Optional sample data: `npm run db:seed-sample -w server`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Production | Set to `production` for deployment. |
| `PORT` | No | API listen port; defaults to `4000`. |
| `DATABASE_URL` | Yes | PostgreSQL connection URL. Keep it in the hosting secret store. |
| `DB_SSL` | Production | Set to `true` for TLS PostgreSQL connections. |
| `SESSION_SECRET` | Yes | Unique random secret with at least 32 characters. |
| `CLIENT_ORIGINS` | Yes | Comma-separated exact browser origins, with scheme and no path. Production origins must use HTTPS. |
| `SESSION_SAME_SITE` | No | `lax` by default; use `none` plus HTTPS for truly cross-site frontend/API domains. |
| `SESSION_MAX_AGE_MS` | No | Session idle lifetime in milliseconds; defaults to 8 hours. |
| `TRUST_PROXY_HOPS` | Production | Trusted reverse proxy hops; defaults to `1`. Set to match the actual ingress topology. |
| `ADMIN_NAME` | Seed | Administrator display name. |
| `ADMIN_EMAIL` | Seed | Administrator email. |
| `ADMIN_PASSWORD` | Seed; production startup | Explicit password, at least 12 characters in development and 16 in production. Do not use example or placeholder values. |
| `VITE_API_URL` | No | Frontend API origin without `/api`; leave empty for same-origin deployments. |
| `API_PROXY_TARGET` | No | Development-only Vite proxy target; defaults to `http://localhost:4000`. |

Frontend build variables are embedded at build time. Do not put secrets in `VITE_*` values.

## PostgreSQL setup and migrations

Docker Compose provides a local-only PostgreSQL instance on port 5432. The sample Compose password is for local development and must not be reused in production. For a local database, the example `DATABASE_URL` and Compose database/user names match.

Run `npm run db:migrate` whenever deploying a release. Migrations run transactionally under a PostgreSQL advisory lock. `schema_migrations` records each applied migration and checksum; applied migration files must not be edited. Add a new numbered SQL file for schema changes. The base migration uses `IF NOT EXISTS` and preserves existing rows.

## Administrator setup

Set the three `ADMIN_*` variables before `npm run db:seed`. Use a password manager to generate a unique password. The seed hashes passwords with bcrypt and preserves an existing account by default. To intentionally rotate the configured administrator password, run `npm run db:seed -w server -- --rotate-password`; review the target `ADMIN_EMAIL` first. This explicit option is useful when upgrading an installation that used the old demo credentials.

## Commands

- `npm ci` — install all workspace dependencies from the lockfile.
- `npm run dev` — run Vite and Express for local development.
- `npm run build` — build the frontend for production.
- `npm test` — run backend route and validation tests.
- `npm run db:migrate` — apply pending database migrations.
- `npm run db:seed` — create the configured administrator if it does not exist.
- `npm run db:seed-sample -w server` — insert optional sample employees.
- `npm start` — start the Express API.

The frontend static output is `client/dist`. Serve it from a static host or reverse proxy and route `/api` and `/health` to the Express service. For split origins, set `VITE_API_URL` to the HTTPS API origin and list the exact HTTPS frontend origin in `CLIENT_ORIGINS`. Credentialed requests require the configured CORS origin and Origin validation. Cross-site cookies need `SESSION_SAME_SITE=none`, HTTPS, and compatible browser cookie policy.

## API

- `GET /health` — API and database health.
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- `GET/POST /api/employees`, `GET/PUT/DELETE /api/employees/:id`.
- `GET /api/dashboard/stats`.

Employee list accepts `page`, `limit` (maximum 50), `search`, `department`, and `status`. CSV export downloads all records matching the current search and filters, across pages.

## Containerized self-hosted deployment

The production Compose stack runs the API and frontend containers and connects to an **external PostgreSQL service with TLS enabled**. It does not expose a bundled production database.

1. Create a managed PostgreSQL database and enable its TLS connection. Keep its connection URL private.
2. Create a root-level `.env` file with `NODE_ENV=production`, `DATABASE_URL`, `DB_SSL=true`, a unique `SESSION_SECRET` (at least 32 random characters), the public HTTPS `CLIENT_ORIGINS`, `ADMIN_NAME`, a valid `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` (at least 16 characters with at least three character classes). Set `TRUST_PROXY_HOPS` to the actual number of trusted reverse-proxy hops; the Compose default is 2 for a host TLS proxy in front of the web container.
3. Build and start the stack: `docker compose -f docker-compose.production.yml up --build -d`.
4. Check startup: `docker compose -f docker-compose.production.yml ps` and `docker compose -f docker-compose.production.yml logs migrate seed api web`.
5. Point your TLS reverse proxy at `127.0.0.1:8080`. Preserve the original `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers. Do not expose the container's port directly without HTTPS.

The migration and idempotent administrator seed jobs run before the API starts. The web container serves the built React app and proxies `/api` and `/health` to the API, keeping the browser session same-origin. Back up PostgreSQL and test restores before using employee data in production. Keep `.env` out of version control.

## Production configuration and deployment prerequisites

Before deployment, configure `NODE_ENV=production`, a strong unique `SESSION_SECRET`, `DATABASE_URL`, `DB_SSL=true`, a strong `ADMIN_PASSWORD`, the exact HTTPS `CLIENT_ORIGINS`, and a correct `TRUST_PROXY_HOPS`. Set frontend `VITE_API_URL` at build time for a separate API origin. Apply migrations before starting the web service. Use HTTPS, managed secret storage, database backups and restore checks, monitoring, restricted database network access, and an operational administrator credential rotation process. Do not commit `.env` files.

## Security notes

Sessions are stored in PostgreSQL, use HttpOnly cookies, expire after the configured lifetime, and regenerate on successful login. Logout destroys the session. HTTPS is required for production secure cookies. Write requests require a configured Origin; CORS allows only configured frontend origins. Login attempts are rate-limited. Helmet, input validation, parameterized SQL, uniqueness and check constraints, safe generic server errors, and CSV formula-injection mitigation are enabled.

The app currently has one administrator role and no public registration or multi-tenant access model. Treat employee records as sensitive personal data and configure retention, access, backups, and legal/privacy controls for your organization.
