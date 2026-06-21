-- +goose Up
ALTER TABLE budgets ADD COLUMN period TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE budgets ADD COLUMN start_date TEXT NOT NULL DEFAULT (CURRENT_DATE);

ALTER TABLE budget_category_lines ADD COLUMN budgeted_frequency TEXT NOT NULL DEFAULT 'monthly';

-- +goose Down
ALTER TABLE budget_category_lines DROP COLUMN budgeted_frequency;
ALTER TABLE budgets DROP COLUMN start_date;
ALTER TABLE budgets DROP COLUMN period;
