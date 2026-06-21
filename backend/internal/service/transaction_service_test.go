package service

import (
	"context"
	"testing"
	"time"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/domain/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestTransactionService_Create_AllowsUnlinkedAccount(t *testing.T) {
	ctx := context.Background()
	mockTxs := mocks.NewMockTransactionRepository(t)
	mockAccounts := mocks.NewMockAccountRepository(t)
	mockCategories := mocks.NewMockCategoryRepository(t)
	mockBudgets := mocks.NewMockBudgetRepository(t)
	mockBudgetLines := mocks.NewMockBudgetCategoryLineRepository(t)

	svc := NewTransactionService(mockTxs, mockAccounts, mockCategories, mockBudgets, nil, mockBudgetLines, nil)

	budget := &domain.Budget{ID: "b-1", UserID: "user-1"}
	acc := &domain.Account{ID: "acc-1", UserID: "user-1", Balance: 10000}
	cat := &domain.Category{ID: "cat-1", UserID: "user-1"}

	mockBudgets.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockAccounts.On("GetByID", mock.Anything, "acc-1").Return(acc, nil)
	mockCategories.On("GetByID", mock.Anything, "cat-1").Return(cat, nil)
	mockBudgetLines.On("EnsureLine", mock.Anything, "b-1", "cat-1").Return(nil)
	mockTxs.On("Create", mock.Anything, mock.AnythingOfType("*domain.Transaction")).Return(nil)
	mockAccounts.On("UpdateBalance", mock.Anything, "acc-1", int64(9000)).Return(nil)

	tx, err := svc.Create(ctx, "b-1", "acc-1", "cat-1", -1000, "Coffee", time.Now())
	require.NoError(t, err)
	assert.Equal(t, "cat-1", tx.CustomerCategoryID)
}

func TestTransactionService_Create_RejectsOtherUsersAccount(t *testing.T) {
	ctx := context.Background()
	mockTxs := mocks.NewMockTransactionRepository(t)
	mockAccounts := mocks.NewMockAccountRepository(t)
	mockCategories := mocks.NewMockCategoryRepository(t)
	mockBudgets := mocks.NewMockBudgetRepository(t)
	mockBudgetLines := mocks.NewMockBudgetCategoryLineRepository(t)

	svc := NewTransactionService(mockTxs, mockAccounts, mockCategories, mockBudgets, nil, mockBudgetLines, nil)

	budget := &domain.Budget{ID: "b-1", UserID: "user-1"}
	acc := &domain.Account{ID: "acc-1", UserID: "user-2", Balance: 10000}

	mockBudgets.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockAccounts.On("GetByID", mock.Anything, "acc-1").Return(acc, nil)

	_, err := svc.Create(ctx, "b-1", "acc-1", "cat-1", -1000, "Coffee", time.Now())
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrForbidden)
}
