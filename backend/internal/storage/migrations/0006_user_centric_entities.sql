-- +goose Up

-- ─── Accounts: user-owned, linked to budgets via junction ─────────────────────

ALTER TABLE accounts ADD COLUMN user_id TEXT REFERENCES users(id);

UPDATE accounts
SET user_id = (SELECT b.user_id FROM budgets b WHERE b.id = accounts.budget_id)
WHERE budget_id IS NOT NULL;

UPDATE accounts
SET user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM users);

DELETE FROM accounts WHERE user_id IS NULL;

CREATE TABLE budget_accounts (
    budget_id  TEXT NOT NULL,
    account_id TEXT NOT NULL,
    PRIMARY KEY (budget_id, account_id),
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

INSERT INTO budget_accounts (budget_id, account_id)
SELECT budget_id, id FROM accounts WHERE budget_id IS NOT NULL;

CREATE TABLE accounts_new (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    balance         BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP NOT NULL,
    class           TEXT,
    account_no      TEXT,
    available_funds BIGINT,
    product         TEXT,
    institution_id  TEXT,
    connection_id   TEXT,
    last_updated    TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO accounts_new (
    id, user_id, name, type, balance, created_at, updated_at,
    class, account_no, available_funds, product, institution_id, connection_id, last_updated
)
SELECT
    id, user_id, name, type, balance, created_at, updated_at,
    class, account_no, available_funds, product, institution_id, connection_id, last_updated
FROM accounts;

DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;

-- ─── Categories: user taxonomy + per-budget envelope lines ──────────────────

CREATE TABLE budget_category_lines (
    budget_id    TEXT NOT NULL,
    category_id  TEXT NOT NULL,
    budgeted     BIGINT NOT NULL DEFAULT 0,
    balance      BIGINT NOT NULL DEFAULT 0,
    target_limit BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL,
    updated_at   TIMESTAMP NOT NULL,
    PRIMARY KEY (budget_id, category_id),
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
);

INSERT INTO budget_category_lines (
    budget_id, category_id, budgeted, balance, target_limit, created_at, updated_at
)
SELECT
    c.budget_id, c.id, c.budgeted, c.balance, c.target_limit, c.created_at, c.updated_at
FROM categories c
WHERE c.budget_id IS NOT NULL;

CREATE TABLE envelope_allocations_backup AS
SELECT * FROM envelope_allocations;

DROP TABLE envelope_allocations;

CREATE TABLE categories_new (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    parent_id           TEXT,
    name                TEXT NOT NULL,
    type                TEXT NOT NULL DEFAULT 'expense',
    color               TEXT NOT NULL DEFAULT '#7c5cff',
    icon                TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    archived            INTEGER NOT NULL DEFAULT 0,
    system              INTEGER NOT NULL DEFAULT 0,
    basiq_subclass_code TEXT,
    anzsic_class_code   TEXT,
    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories_new(id) ON DELETE SET NULL
);

INSERT INTO categories_new (
    id, user_id, parent_id, name, type, color, icon, sort_order, archived, system,
    basiq_subclass_code, anzsic_class_code, created_at, updated_at
)
SELECT
    c.id,
    COALESCE(b.user_id, (SELECT id FROM users ORDER BY created_at LIMIT 1)),
    NULL,
    c.name,
    'expense',
    '#7c5cff',
    NULL,
    0,
    0,
    0,
    NULL,
    NULL,
    c.created_at,
    c.updated_at
FROM categories c
LEFT JOIN budgets b ON c.budget_id = b.id
WHERE COALESCE(b.user_id, (SELECT id FROM users ORDER BY created_at LIMIT 1)) IS NOT NULL;

DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;

CREATE TABLE envelope_allocations (
    budget_id   TEXT NOT NULL,
    account_id  TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount      BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL,
    PRIMARY KEY (budget_id, account_id, category_id),
    FOREIGN KEY(budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

INSERT INTO envelope_allocations
SELECT * FROM envelope_allocations_backup;

DROP TABLE envelope_allocations_backup;

-- +goose Down

CREATE TABLE categories_old (
    id           TEXT PRIMARY KEY,
    budget_id    TEXT,
    name         TEXT NOT NULL,
    budgeted     BIGINT NOT NULL DEFAULT 0,
    balance      BIGINT NOT NULL DEFAULT 0,
    target_limit BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL,
    updated_at   TIMESTAMP NOT NULL,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE SET NULL
);

INSERT INTO categories_old (id, budget_id, name, budgeted, balance, target_limit, created_at, updated_at)
SELECT
    c.id,
    bcl.budget_id,
    c.name,
    COALESCE(bcl.budgeted, 0),
    COALESCE(bcl.balance, 0),
    COALESCE(bcl.target_limit, 0),
    c.created_at,
    c.updated_at
FROM categories c
LEFT JOIN budget_category_lines bcl ON bcl.category_id = c.id
LIMIT 999999;

DROP TABLE categories;
ALTER TABLE categories_old RENAME TO categories;

DROP TABLE budget_category_lines;

CREATE TABLE accounts_old (
    id              TEXT PRIMARY KEY,
    budget_id       TEXT,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    balance         BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP NOT NULL,
    class           TEXT,
    account_no      TEXT,
    available_funds BIGINT,
    product         TEXT,
    institution_id  TEXT,
    connection_id   TEXT,
    last_updated    TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE SET NULL
);

INSERT INTO accounts_old (
    id, budget_id, name, type, balance, created_at, updated_at,
    class, account_no, available_funds, product, institution_id, connection_id, last_updated
)
SELECT
    a.id,
    (SELECT ba.budget_id FROM budget_accounts ba WHERE ba.account_id = a.id LIMIT 1),
    a.name, a.type, a.balance, a.created_at, a.updated_at,
    a.class, a.account_no, a.available_funds, a.product, a.institution_id, a.connection_id, a.last_updated
FROM accounts a;

DROP TABLE accounts;
ALTER TABLE accounts_old RENAME TO accounts;

DROP TABLE budget_accounts;

ALTER TABLE accounts ADD COLUMN user_id TEXT REFERENCES users(id);
