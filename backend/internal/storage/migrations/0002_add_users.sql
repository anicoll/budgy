-- +goose Up
-- +goose NO TRANSACTION
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    basiq_user_id TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Recreate budgets to add user_id column and foreign key constraint
ALTER TABLE budgets RENAME TO budgets_old;
CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    currency TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO budgets (id, name, method, currency, created_at, updated_at)
SELECT id, name, method, currency, created_at, updated_at FROM budgets_old;
DROP TABLE budgets_old;
PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;

-- +goose Down
PRAGMA foreign_keys=OFF;
ALTER TABLE budgets RENAME TO budgets_old;
CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    currency TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
INSERT INTO budgets (id, name, method, currency, created_at, updated_at)
SELECT id, name, method, currency, created_at, updated_at FROM budgets_old;
DROP TABLE budgets_old;
DROP TABLE users;
PRAGMA foreign_keys=ON;
