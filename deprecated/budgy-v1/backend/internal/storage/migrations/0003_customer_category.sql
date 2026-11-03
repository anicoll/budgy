-- +goose Up
ALTER TABLE transactions ADD COLUMN customer_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE transactions DROP COLUMN customer_category_id;
