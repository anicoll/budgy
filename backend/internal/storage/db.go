package storage

import (
	"context"
	"budgeting_system/internal/domain"
)

// BudgetRepository defines storage operations for budgets.
type BudgetRepository interface {
	Create(ctx context.Context, b *domain.Budget) error
	GetByID(ctx context.Context, id string) (*domain.Budget, error)
	List(ctx context.Context) ([]*domain.Budget, error)
}

// AccountRepository defines storage operations for accounts.
type AccountRepository interface {
	Create(ctx context.Context, acc *domain.Account) error
	GetByID(ctx context.Context, id string) (*domain.Account, error)
	ListByBudget(ctx context.Context, budgetID string) ([]*domain.Account, error)
	UpdateBalance(ctx context.Context, id string, balance int64) error
}

// CategoryRepository defines storage operations for categories/envelopes.
type CategoryRepository interface {
	Create(ctx context.Context, c *domain.Category) error
	GetByID(ctx context.Context, id string) (*domain.Category, error)
	ListByBudget(ctx context.Context, budgetID string) ([]*domain.Category, error)
	UpdateBudgetedAndBalance(ctx context.Context, id string, budgeted int64, balance int64) error
}

// TransactionRepository defines storage operations for transactions.
type TransactionRepository interface {
	Create(ctx context.Context, tx *domain.Transaction) error
	GetByID(ctx context.Context, id string) (*domain.Transaction, error)
	ListByBudget(ctx context.Context, budgetID string) ([]*domain.Transaction, error)
	ListByAccount(ctx context.Context, accountID string) ([]*domain.Transaction, error)
	ListByCategory(ctx context.Context, categoryID string) ([]*domain.Transaction, error)
}
