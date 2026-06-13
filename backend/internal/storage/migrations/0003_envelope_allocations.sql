-- +goose Up
CREATE TABLE envelope_allocations (
    budget_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    PRIMARY KEY (budget_id, account_id, category_id),
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Recreate transactions table without budget_id column and constraint
CREATE TABLE transactions_new (
    id TEXT PRIMARY KEY,
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
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);

INSERT INTO transactions_new (
    id, account_id, category_id, amount, description, date, created_at, updated_at, 
    direction, status, class, post_date, sub_class, raw_description, merchant_name
)
SELECT 
    id, account_id, category_id, amount, description, date, created_at, updated_at, 
    direction, status, class, post_date, sub_class, raw_description, merchant_name
FROM transactions;

DROP TABLE transactions;

ALTER TABLE transactions_new RENAME TO transactions;

-- +goose Down
CREATE TABLE transactions_old (
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

INSERT INTO transactions_old (
    id, budget_id, account_id, category_id, amount, description, date, created_at, updated_at, 
    direction, status, class, post_date, sub_class, raw_description, merchant_name
)
SELECT 
    id, NULL, account_id, category_id, amount, description, date, created_at, updated_at, 
    direction, status, class, post_date, sub_class, raw_description, merchant_name
FROM transactions;

DROP TABLE transactions;

ALTER TABLE transactions_old RENAME TO transactions;

DROP TABLE IF EXISTS envelope_allocations;
