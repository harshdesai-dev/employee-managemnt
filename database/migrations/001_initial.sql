CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL,
 email VARCHAR(255) NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role VARCHAR(30) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS employees (
 id BIGSERIAL PRIMARY KEY, employee_code VARCHAR(30) NOT NULL UNIQUE,
 full_name VARCHAR(140) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
 phone VARCHAR(30) NOT NULL, department VARCHAR(80) NOT NULL,
 designation VARCHAR(100) NOT NULL, salary NUMERIC(12,2) NOT NULL CHECK (salary >= 0),
 joining_date DATE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'Active'
 CHECK (status IN ('Active','On Leave','Inactive')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS employees_name_idx ON employees (LOWER(full_name));
CREATE INDEX IF NOT EXISTS employees_department_idx ON employees (department);
CREATE INDEX IF NOT EXISTS employees_status_idx ON employees (status);
CREATE TABLE IF NOT EXISTS user_sessions (
 sid VARCHAR NOT NULL PRIMARY KEY,
 sess JSON NOT NULL,
 expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions (expire);
