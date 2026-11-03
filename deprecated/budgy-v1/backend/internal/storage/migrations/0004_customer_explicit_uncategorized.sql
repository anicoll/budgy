-- +goose Up
ALTER TABLE transactions ADD COLUMN customer_category_explicit_none INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE transactions DROP COLUMN customer_category_explicit_none;
