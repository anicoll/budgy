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

func (r *budgetAccountRepository) FindBudgetForAccount(ctx context.Context, accountID string) (string, error) {
	var budgetID string
	err := r.db.QueryRowContext(ctx,
		`SELECT budget_id FROM budget_accounts WHERE account_id = ? LIMIT 1`,
		accountID,
	).Scan(&budgetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return budgetID, nil
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
	freq := string(line.BudgetedFrequency)
	if freq == "" {
		freq = string(domain.FrequencyMonthly)
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO budget_category_lines (budget_id, category_id, budgeted, balance, target_limit, budgeted_frequency, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(budget_id, category_id) DO UPDATE SET
			budgeted = excluded.budgeted,
			balance = excluded.balance,
			target_limit = excluded.target_limit,
			budgeted_frequency = excluded.budgeted_frequency,
			updated_at = excluded.updated_at`,
		line.BudgetID, line.CategoryID, line.Budgeted, line.Balance, line.TargetLimit, freq,
		line.CreatedAt, line.UpdatedAt,
	)
	return err
}

func (r *budgetCategoryLineRepository) Get(ctx context.Context, budgetID, categoryID string) (*domain.BudgetCategoryLine, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT budget_id, category_id, budgeted, balance, target_limit, budgeted_frequency, created_at, updated_at
		FROM budget_category_lines WHERE budget_id = ? AND category_id = ?`,
		budgetID, categoryID,
	)
	return scanBudgetCategoryLine(row)
}

func scanBudgetCategoryLine(row interface {
	Scan(dest ...any) error
}) (*domain.BudgetCategoryLine, error) {
	var line domain.BudgetCategoryLine
	var freq string
	err := row.Scan(&line.BudgetID, &line.CategoryID, &line.Budgeted, &line.Balance, &line.TargetLimit, &freq, &line.CreatedAt, &line.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("budget category line not found")
		}
		return nil, err
	}
	line.BudgetedFrequency = domain.BudgetFrequency(freq)
	if line.BudgetedFrequency == "" {
		line.BudgetedFrequency = domain.FrequencyMonthly
	}
	return &line, nil
}

func (r *budgetCategoryLineRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.BudgetCategoryLine, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT budget_id, category_id, budgeted, balance, target_limit, budgeted_frequency, created_at, updated_at
		FROM budget_category_lines WHERE budget_id = ?`, budgetID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.BudgetCategoryLine
	for rows.Next() {
		line, err := scanBudgetCategoryLine(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, line)
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

func (r *budgetCategoryLineRepository) UpdateBudgeted(ctx context.Context, budgetID, categoryID string, budgeted int64, frequency domain.BudgetFrequency) error {
	freq := string(frequency)
	if freq == "" {
		freq = string(domain.FrequencyMonthly)
	}
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO budget_category_lines (budget_id, category_id, budgeted, balance, target_limit, budgeted_frequency, created_at, updated_at)
		VALUES (?, ?, ?, 0, 0, ?, ?, ?)
		ON CONFLICT(budget_id, category_id) DO UPDATE SET
			budgeted = excluded.budgeted,
			budgeted_frequency = excluded.budgeted_frequency,
			updated_at = excluded.updated_at`,
		budgetID, categoryID, budgeted, freq, now, now,
	)
	return err
}

func (r *budgetCategoryLineRepository) EnsureLine(ctx context.Context, budgetID, categoryID string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
		INSERT OR IGNORE INTO budget_category_lines (budget_id, category_id, budgeted, balance, target_limit, budgeted_frequency, created_at, updated_at)
		VALUES (?, ?, 0, 0, 0, 'monthly', ?, ?)`,
		budgetID, categoryID, now, now,
	)
	return err
}

func (r *budgetCategoryLineRepository) ListBudgetCategories(ctx context.Context, budgetID string) ([]*domain.BudgetCategory, error) {
	query := `
		SELECT c.id, c.user_id, c.parent_id, c.name, c.type, c.color, c.icon, c.sort_order,
		       c.archived, c.system, c.basiq_subclass_code, c.anzsic_class_code, c.created_at, c.updated_at,
		       bcl.budgeted, bcl.balance, bcl.target_limit, bcl.budgeted_frequency
		FROM budget_category_lines bcl
		INNER JOIN categories c ON c.id = bcl.category_id
		WHERE bcl.budget_id = ?
		ORDER BY c.sort_order, c.name`
	rows, err := r.db.QueryContext(ctx, query, budgetID)
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

func (r *budgetCategoryLineRepository) ListAvailableCategories(ctx context.Context, budgetID string) ([]*domain.Category, error) {
	query := `
		SELECT c.id, c.user_id, c.parent_id, c.name, c.type, c.color, c.icon, c.sort_order,
		       c.archived, c.system, c.basiq_subclass_code, c.anzsic_class_code, c.created_at, c.updated_at
		FROM categories c
		WHERE c.user_id = (SELECT user_id FROM budgets WHERE id = ?)
		  AND c.archived = 0
		  AND NOT EXISTS (
		    SELECT 1 FROM budget_category_lines bcl
		    WHERE bcl.budget_id = ? AND bcl.category_id = c.id
		  )
		ORDER BY c.sort_order, c.name`
	rows, err := r.db.QueryContext(ctx, query, budgetID, budgetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCategories(rows)
}
