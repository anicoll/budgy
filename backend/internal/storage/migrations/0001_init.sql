-- +goose Up
CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    currency TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

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

-- +goose Down
DROP TABLE transactions;
DROP TABLE categories;
DROP TABLE accounts;
DROP TABLE budgets;

