package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"budgeting_system/internal/domain"
)

type budgetAccountRepository struct {
	db *sql.DB
}

func (r *budgetAccountRepository) Link(ctx context.Context, budgetID, accountID string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO budget_accounts (budget_id, account_id) VALUES (?, ?)`,
		budgetID, accountID,
	)
	return err
}

func (r *budgetAccountRepository) Unlink(ctx context.Context, budgetID, accountID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM budget_accounts WHERE budget_id = ? AND account_id = ?`,
		budgetID, accountID,
	)
	return err
}

func (r *budgetAccountRepository) ListByBudget(ctx context.Context, budgetID string) ([]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT account_id FROM budget_accounts WHERE budget_id = ?`, budgetID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *budgetAccountRepository) ListAccountsByBudget(ctx context.Context, budgetID string) ([]*domain.Account, error) {
	query := `
		SELECT a.id, a.user_id, a.name, a.type, a.balance, a.created_at, a.updated_at,
		       a.class, a.account_no, a.available_funds, a.product, a.institution_id, a.connection_id, a.last_updated
		FROM accounts a
		INNER JOIN budget_accounts ba ON ba.account_id = a.id
		WHERE ba.budget_id = ?`
	rows, err := r.db.QueryContext(ctx, query, budgetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAccounts(ctx, rows)
}

type budgetCategoryLineRepository struct {
	db *sql.DB
}

func (r *budgetCategoryLineRepository) Upsert(ctx context.Context, line *domain.BudgetCategoryLine) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO budget_category_lines (budget_id, category_id, budgeted, balance, target_limit, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(budget_id, category_id) DO UPDATE SET
			budgeted = excluded.budgeted,
			balance = excluded.balance,
			target_limit = excluded.target_limit,
			updated_at = excluded.updated_at`,
		line.BudgetID, line.CategoryID, line.Budgeted, line.Balance, line.TargetLimit,
		line.CreatedAt, line.UpdatedAt,
	)
	return err
}

func (r *budgetCategoryLineRepository) Get(ctx context.Context, budgetID, categoryID string) (*domain.BudgetCategoryLine, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT budget_id, category_id, budgeted, balance, target_limit, created_at, updated_at
		FROM budget_category_lines WHERE budget_id = ? AND category_id = ?`,
		budgetID, categoryID,
	)
	var line domain.BudgetCategoryLine
	err := row.Scan(&line.BudgetID, &line.CategoryID, &line.Budgeted, &line.Balance, &line.TargetLimit, &line.CreatedAt, &line.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("budget category line not found")
		}
		return nil, err
	}
	return &line, nil
}

func (r *budgetCategoryLineRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.BudgetCategoryLine, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT budget_id, category_id, budgeted, balance, target_limit, created_at, updated_at
		FROM budget_category_lines WHERE budget_id = ?`, budgetID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.BudgetCategoryLine
	for rows.Next() {
		var line domain.BudgetCategoryLine
		if err := rows.Scan(&line.BudgetID, &line.CategoryID, &line.Budgeted, &line.Balance, &line.TargetLimit, &line.CreatedAt, &line.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, &line)
	}
	return list, rows.Err()
}

func (r *budgetCategoryLineRepository) UpdateBudgetedAndBalance(ctx context.Context, budgetID, categoryID string, budgeted, balance int64) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE budget_category_lines SET budgeted = ?, balance = ?, updated_at = ?
		WHERE budget_id = ? AND category_id = ?`,
		budgeted, balance, time.Now(), budgetID, categoryID,
	)
	return err
}

func (r *budgetCategoryLineRepository) EnsureLine(ctx context.Context, budgetID, categoryID string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
		INSERT OR IGNORE INTO budget_category_lines (budget_id, category_id, budgeted, balance, target_limit, created_at, updated_at)
		VALUES (?, ?, 0, 0, 0, ?, ?)`,
		budgetID, categoryID, now, now,
	)
	return err
}

func (r *budgetCategoryLineRepository) ListBudgetCategories(ctx context.Context, budgetID string) ([]*domain.BudgetCategory, error) {
	query := `
		SELECT c.id, c.user_id, c.parent_id, c.name, c.type, c.color, c.icon, c.sort_order,
		       c.archived, c.system, c.basiq_subclass_code, c.anzsic_class_code, c.created_at, c.updated_at,
		       COALESCE(bcl.budgeted, 0), COALESCE(bcl.balance, 0), COALESCE(bcl.target_limit, 0)
		FROM categories c
		LEFT JOIN budget_category_lines bcl ON bcl.category_id = c.id AND bcl.budget_id = ?
		WHERE c.user_id = (SELECT user_id FROM budgets WHERE id = ?)
		ORDER BY c.sort_order, c.name`
	rows, err := r.db.QueryContext(ctx, query, budgetID, budgetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.BudgetCategory
	for rows.Next() {
		bc, err := scanBudgetCategoryRow(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, bc)
	}
	return list, rows.Err()
}
