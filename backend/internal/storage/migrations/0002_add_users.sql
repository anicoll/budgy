-- +goose Up
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

ALTER TABLE budgets ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE budgets DROP COLUMN user_id;
DROP TABLE users;
