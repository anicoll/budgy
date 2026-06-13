-- name: GetBudget :one
SELECT * FROM budgets
WHERE id = $1 LIMIT 1;
