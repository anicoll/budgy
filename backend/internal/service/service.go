package service

//go:generate go run github.com/vektra/mockery/v3@v3.7.1 --config ../../.mockery.yml

import (
	"context"
	"errors"
	"fmt"
	"time"

	"budgeting_system/internal/domain"

	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("resource not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrConflict     = errors.New("conflict")
	ErrBadRequest   = errors.New("bad request")
)

type CategorySeeder interface {
	SeedCategoriesForUser(ctx context.Context, userID string) error
}

type AuthService interface {
	Register(ctx context.Context, email, password, firstName, lastName string) (*domain.User, error)
	Login(ctx context.Context, email, password string) (*domain.User, error)
	GetUserByID(ctx context.Context, userID string) (*domain.User, error)
	GetUserByBasiqUserID(ctx context.Context, basiqUserID string) (*domain.User, error)
}

type BudgetService interface {
	Create(ctx context.Context, userID, name string, method domain.BudgetMethod, currency string, period domain.BudgetPeriod, startDate string) (*domain.Budget, error)
	GetByID(ctx context.Context, id string) (*domain.Budget, error)
	List(ctx context.Context, userID string) ([]*domain.Budget, error)
	Update(ctx context.Context, id string, name string, method domain.BudgetMethod, currency string, period domain.BudgetPeriod, startDate string) (*domain.Budget, error)
	Delete(ctx context.Context, id string) error
	GetSummary(ctx context.Context, id string) (any, error)
	ListBudgetCategories(ctx context.Context, budgetID string) ([]*domain.BudgetCategory, error)
	ListAvailableCategories(ctx context.Context, budgetID string) ([]*domain.Category, error)
	AddCategoryToBudget(ctx context.Context, budgetID, catID string) (*domain.BudgetCategory, error)
	AssignCategoryFunds(ctx context.Context, budgetID, catID string, amount int64, frequency domain.BudgetFrequency, replace bool) (*domain.BudgetCategory, error)
	FundEnvelope(ctx context.Context, budgetID, catID, accountID string, amount int64) (*domain.Account, *domain.BudgetCategory, error)
	domain.BudgetReconciler
	ReconcileAllForUser(ctx context.Context, userID string) error
	ReconcileForAccount(ctx context.Context, accountID string) error
}

type AccountService interface {
	Create(ctx context.Context, userID, name string, accType domain.AccountType, balance int64) (*domain.Account, error)
	List(ctx context.Context, userID string) ([]*domain.Account, error)
	ListByBudget(ctx context.Context, budgetID string) ([]*domain.Account, error)
	GetByID(ctx context.Context, id string) (*domain.Account, error)
	Update(ctx context.Context, acc *domain.Account) (*domain.Account, error)
	Delete(ctx context.Context, id string) error
	LinkToBudget(ctx context.Context, budgetID, accountID, userID string) error
	UnlinkFromBudget(ctx context.Context, budgetID, accountID, userID string) error
}

type CategoryService interface {
	Create(ctx context.Context, userID string, cat *domain.Category) (*domain.Category, error)
	List(ctx context.Context, userID string) ([]*domain.Category, error)
	GetByID(ctx context.Context, id string) (*domain.Category, error)
	Update(ctx context.Context, cat *domain.Category) (*domain.Category, error)
	Delete(ctx context.Context, id string) error
}

type TransactionService interface {
	Create(ctx context.Context, budgetID, accountID, categoryID string, amount int64, description string, date time.Time) (*domain.Transaction, error)
	List(ctx context.Context, budgetID string) ([]*domain.Transaction, error)
	ListByUser(ctx context.Context, userID string) ([]*domain.Transaction, error)
	Update(ctx context.Context, budgetID, txID string, updates *domain.Transaction, customerCategory *string) (*domain.Transaction, error)
	Delete(ctx context.Context, budgetID, txID string) error
}

type BankSyncService interface {
	GetAuthLink(ctx context.Context, userID string) (string, string, error)
	SyncUser(ctx context.Context, userID string) error
}

func generateID() string {
	return uuid.New().String()
}

func verifyBudgetOwner(b *domain.Budget, userID string) error {
	if b.UserID != userID {
		return fmt.Errorf("%w: budget does not belong to user", ErrForbidden)
	}
	return nil
}

func verifyAccountOwner(acc *domain.Account, userID string) error {
	if acc.UserID != userID {
		return fmt.Errorf("%w: account does not belong to user", ErrForbidden)
	}
	return nil
}

func verifyCategoryOwner(cat *domain.Category, userID string) error {
	if cat.UserID != userID {
		return fmt.Errorf("%w: category does not belong to user", ErrForbidden)
	}
	return nil
}
