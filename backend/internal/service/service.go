package service

//go:generate go run github.com/vektra/mockery/v3@v3.7.1 --config ../../.mockery.yml

import (
	"context"
	"errors"
	"time"

	"budgeting_system/internal/domain"

	"github.com/google/uuid"
)

// Define custom errors
var (
	ErrNotFound     = errors.New("resource not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrConflict     = errors.New("conflict")
	ErrBadRequest   = errors.New("bad request")
)

// AuthService coordinates user registration, authentication, and management.
type AuthService interface {
	Register(ctx context.Context, email, password, firstName, lastName string) (*domain.User, error)
	Login(ctx context.Context, email, password string) (*domain.User, error)
	GetUserByID(ctx context.Context, userID string) (*domain.User, error)
	GetUserByBasiqUserID(ctx context.Context, basiqUserID string) (*domain.User, error)
}

// BudgetService coordinates budget CRUD and summary operations.
type BudgetService interface {
	Create(ctx context.Context, userID, name string, method domain.BudgetMethod, currency string) (*domain.Budget, error)
	GetByID(ctx context.Context, id string) (*domain.Budget, error)
	List(ctx context.Context, userID string) ([]*domain.Budget, error)
	Update(ctx context.Context, id string, name string, method domain.BudgetMethod, currency string) (*domain.Budget, error)
	Delete(ctx context.Context, id string) error
	GetSummary(ctx context.Context, id string) (any, error)
}

// AccountService coordinates account operations.
type AccountService interface {
	Create(ctx context.Context, budgetID, name string, accType domain.AccountType, balance int64) (*domain.Account, error)
	List(ctx context.Context, budgetID string) ([]*domain.Account, error)
	GetByID(ctx context.Context, id string) (*domain.Account, error)
	Update(ctx context.Context, acc *domain.Account) (*domain.Account, error)
	Delete(ctx context.Context, id string) error
}

// CategoryService coordinates categories and envelope funding.
type CategoryService interface {
	Create(ctx context.Context, budgetID, name string, targetLimit int64) (*domain.Category, error)
	List(ctx context.Context, budgetID string) ([]*domain.Category, error)
	GetByID(ctx context.Context, id string) (*domain.Category, error)
	Update(ctx context.Context, cat *domain.Category) (*domain.Category, error)
	Delete(ctx context.Context, id string) error
	AssignFunds(ctx context.Context, budgetID, catID string, amount int64) (*domain.Category, error)
	FundEnvelope(ctx context.Context, budgetID, catID, accountID string, amount int64) (*domain.Account, *domain.Category, error)
}

// TransactionService coordinates transactions.
type TransactionService interface {
	Create(ctx context.Context, budgetID, accountID, categoryID string, amount int64, description string, date time.Time) (*domain.Transaction, error)
	List(ctx context.Context, budgetID string) ([]*domain.Transaction, error)
	Update(ctx context.Context, budgetID, txID string, updates *domain.Transaction) (*domain.Transaction, error)
	Delete(ctx context.Context, budgetID, txID string) error
}

// BankSyncService coordinates bank syncing integrations.
type BankSyncService interface {
	GetAuthLink(ctx context.Context, userID string) (string, string, error) // token, connectURL, err
	SyncUser(ctx context.Context, userID string) error
}

func generateID() string {
	return uuid.New().String()
}
