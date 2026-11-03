-- +goose Up

CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    basiq_user_id TEXT,
    created_at    TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP NOT NULL
);

CREATE TABLE budgets (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    method     TEXT NOT NULL,
    currency   TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE accounts (
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

CREATE TABLE categories (
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
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE budget_accounts (
    budget_id  TEXT NOT NULL,
    account_id TEXT NOT NULL,
    PRIMARY KEY (budget_id, account_id),
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE budget_category_lines (
    budget_id    TEXT NOT NULL,
    category_id  TEXT NOT NULL,
    budgeted     BIGINT NOT NULL DEFAULT 0,
    balance      BIGINT NOT NULL DEFAULT 0,
    target_limit BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL,
    updated_at   TIMESTAMP NOT NULL,
    PRIMARY KEY (budget_id, category_id),
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE transactions (
    id               TEXT PRIMARY KEY,
    account_id       TEXT NOT NULL,
    category_id      TEXT,
    amount           BIGINT NOT NULL,
    description      TEXT NOT NULL,
    date             TIMESTAMP NOT NULL,
    created_at       TIMESTAMP NOT NULL,
    updated_at       TIMESTAMP NOT NULL,
    direction        TEXT,
    status           TEXT,
    class            TEXT,
    post_date        TIMESTAMP,
    sub_class        TEXT,
    raw_description  TEXT,
    merchant_name    TEXT,
    merchant_website TEXT,
    merchant_logo_url TEXT,
    location_address TEXT,
    location_lat     TEXT,
    location_lng     TEXT,
    category_code    TEXT,
    category_title   TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE envelope_allocations (
    budget_id   TEXT NOT NULL,
    account_id  TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount      BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL,
    PRIMARY KEY (budget_id, account_id, category_id),
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE background_jobs (
    id            TEXT PRIMARY KEY,
    job_type      TEXT NOT NULL,
    payload       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    attempts      INTEGER NOT NULL DEFAULT 0,
    max_attempts  INTEGER NOT NULL DEFAULT 5,
    run_at        TIMESTAMP NOT NULL,
    error_message TEXT,
    created_at    TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP NOT NULL
);

CREATE INDEX idx_background_jobs_pending ON background_jobs (status, run_at);

-- +goose Down
DROP TABLE IF EXISTS background_jobs;
DROP TABLE IF EXISTS envelope_allocations;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS budget_category_lines;
DROP TABLE IF EXISTS budget_accounts;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS users;
