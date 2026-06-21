package domain

import "context"

// BudgetAccountRepository manages budget ↔ account links.
type BudgetAccountRepository interface {
	Link(ctx context.Context, budgetID, accountID string) error
	Unlink(ctx context.Context, budgetID, accountID string) error
	ListByBudget(ctx context.Context, budgetID string) ([]string, error)
	ListAccountsByBudget(ctx context.Context, budgetID string) ([]*Account, error)
	FindBudgetForAccount(ctx context.Context, accountID string) (string, error)
}

// BudgetCategoryLineRepository manages per-budget category envelope state.
type BudgetCategoryLineRepository interface {
	Upsert(ctx context.Context, line *BudgetCategoryLine) error
	Get(ctx context.Context, budgetID, categoryID string) (*BudgetCategoryLine, error)
	ListByBudget(ctx context.Context, budgetID string) ([]*BudgetCategoryLine, error)
	UpdateBudgetedAndBalance(ctx context.Context, budgetID, categoryID string, budgeted, balance int64) error
	UpdateBudgeted(ctx context.Context, budgetID, categoryID string, budgeted int64, frequency BudgetFrequency) error
	EnsureLine(ctx context.Context, budgetID, categoryID string) error
	ListBudgetCategories(ctx context.Context, budgetID string) ([]*BudgetCategory, error)
	ListAvailableCategories(ctx context.Context, budgetID string) ([]*Category, error)
}
