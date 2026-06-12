-- +goose Up
PRAGMA foreign_keys=OFF;

-- Rename existing tables
ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE categories RENAME TO categories_old;
ALTER TABLE transactions RENAME TO transactions_old;

-- Create new tables with ON DELETE SET NULL and Basiq alignment columns
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    budget_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    class TEXT,
    account_no TEXT,
    available_funds BIGINT,
    product TEXT,
    institution_id TEXT,
    connection_id TEXT,
    last_updated TIMESTAMP,
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE SET NULL
);

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    budget_id TEXT,
    name TEXT NOT NULL,
    budgeted BIGINT NOT NULL DEFAULT 0,
    balance BIGINT NOT NULL DEFAULT 0,
    target_limit BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE SET NULL
);

CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    budget_id TEXT,
    account_id TEXT NOT NULL,
    category_id TEXT,
    amount BIGINT NOT NULL,
    description TEXT NOT NULL,
    date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    direction TEXT,
    status TEXT,
    class TEXT,
    post_date TIMESTAMP,
    sub_class TEXT,
    raw_description TEXT,
    merchant_name TEXT,
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE SET NULL,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Copy data from old tables to new tables
INSERT INTO accounts (id, budget_id, name, type, balance, created_at, updated_at)
SELECT id, budget_id, name, type, balance, created_at, updated_at FROM accounts_old;

INSERT INTO categories (id, budget_id, name, budgeted, balance, target_limit, created_at, updated_at)
SELECT id, budget_id, name, budgeted, balance, target_limit, created_at, updated_at FROM categories_old;

INSERT INTO transactions (id, budget_id, account_id, category_id, amount, description, date, created_at, updated_at)
SELECT id, budget_id, account_id, category_id, amount, description, date, created_at, updated_at FROM transactions_old;

-- Drop old tables
DROP TABLE transactions_old;
DROP TABLE categories_old;
DROP TABLE accounts_old;

PRAGMA foreign_keys=ON;

-- +goose Down
PRAGMA foreign_keys=OFF;

-- Rename existing tables
ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE categories RENAME TO categories_old;
ALTER TABLE transactions RENAME TO transactions_old;

-- Recreate old tables with ON DELETE CASCADE and no Basiq columns
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE
);

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    name TEXT NOT NULL,
    budgeted BIGINT NOT NULL DEFAULT 0,
    balance BIGINT NOT NULL DEFAULT 0,
    target_limit BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE
);

CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT,
    amount BIGINT NOT NULL,
    description TEXT NOT NULL,
    date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Copy data back (filtering out rows with null budget_id if any, or keeping them if possible)
INSERT INTO accounts (id, budget_id, name, type, balance, created_at, updated_at)
SELECT id, COALESCE(budget_id, ''), name, type, balance, created_at, updated_at FROM accounts_old;

INSERT INTO categories (id, budget_id, name, budgeted, balance, target_limit, created_at, updated_at)
SELECT id, COALESCE(budget_id, ''), name, budgeted, balance, target_limit, created_at, updated_at FROM categories_old;

INSERT INTO transactions (id, budget_id, account_id, category_id, amount, description, date, created_at, updated_at)
SELECT id, COALESCE(budget_id, ''), account_id, category_id, amount, description, date, created_at, updated_at FROM transactions_old;

-- Drop old tables
DROP TABLE transactions_old;
DROP TABLE categories_old;
DROP TABLE accounts_old;

PRAGMA foreign_keys=ON;
