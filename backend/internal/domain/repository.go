package domain

//go:generate go run github.com/vektra/mockery/v3@v3.7.1 --config ../../.mockery.yml

import (
	"context"
)

// BudgetRepository defines storage operations for budgets.
type BudgetRepository interface {
	Create(ctx context.Context, b *Budget) error
	GetByID(ctx context.Context, id string) (*Budget, error)
	List(ctx context.Context, userID string) ([]*Budget, error)
	Update(ctx context.Context, b *Budget) error
	Delete(ctx context.Context, id string) error
}

// AccountRepository defines storage operations for accounts.
type AccountRepository interface {
	Create(ctx context.Context, acc *Account) error
	GetByID(ctx context.Context, id string) (*Account, error)
	ListByBudget(ctx context.Context, budgetID string) ([]*Account, error)
	UpdateBalance(ctx context.Context, id string, balance int64) error
	Update(ctx context.Context, acc *Account) error
	Delete(ctx context.Context, id string) error
}

// CategoryRepository defines storage operations for categories/envelopes.
type CategoryRepository interface {
	Create(ctx context.Context, c *Category) error
	GetByID(ctx context.Context, id string) (*Category, error)
	ListByBudget(ctx context.Context, budgetID string) ([]*Category, error)
	UpdateBudgetedAndBalance(ctx context.Context, id string, budgeted int64, balance int64) error
	Update(ctx context.Context, c *Category) error
	Delete(ctx context.Context, id string) error
}

// TransactionRepository defines storage operations for transactions.
type TransactionRepository interface {
	Create(ctx context.Context, tx *Transaction) error
	GetByID(ctx context.Context, id string) (*Transaction, error)
	ListByBudget(ctx context.Context, budgetID string) ([]*Transaction, error)
	ListByAccount(ctx context.Context, accountID string) ([]*Transaction, error)
	ListByCategory(ctx context.Context, categoryID string) ([]*Transaction, error)
	Update(ctx context.Context, tx *Transaction) error
	Delete(ctx context.Context, id string) error
}

// AllocationRepository defines storage operations for envelope allocations.
type AllocationRepository interface {
	Upsert(ctx context.Context, alloc *EnvelopeAllocation) error
	Get(ctx context.Context, budgetID, accountID, categoryID string) (*EnvelopeAllocation, error)
	ListByBudget(ctx context.Context, budgetID string) ([]*EnvelopeAllocation, error)
	ListByAccount(ctx context.Context, budgetID, accountID string) ([]*EnvelopeAllocation, error)
	Delete(ctx context.Context, budgetID, accountID, categoryID string) error
}

// UserRepository defines storage operations for users.
type UserRepository interface {
	Create(ctx context.Context, u *User) error
	GetByID(ctx context.Context, id string) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByBasiqUserID(ctx context.Context, basiqID string) (*User, error)
	UpdateBasiqUserID(ctx context.Context, id string, basiqID string) error
}

