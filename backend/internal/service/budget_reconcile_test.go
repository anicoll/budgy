package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/domain/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestBudgetService_ReconcileFromTransactions(t *testing.T) {
	mockBudgetRepo := mocks.NewMockBudgetRepository(t)
	mockAccRepo := mocks.NewMockAccountRepository(t)
	mockBudgetAccts := mocks.NewMockBudgetAccountRepository(t)
	mockBudgetLines := mocks.NewMockBudgetCategoryLineRepository(t)
	mockTxRepo := mocks.NewMockTransactionRepository(t)

	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodZeroSum}
	line := &domain.BudgetCategoryLine{
		BudgetID:   "b-1",
		CategoryID: "cat-1",
		Budgeted:   10000,
	}

	mockBudgetRepo.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockBudgetAccts.On("ListByBudget", mock.Anything, "b-1").Return([]string{"acc-1"}, nil)
	mockTxRepo.On("ListByAccount", mock.Anything, "acc-1").Return([]*domain.Transaction{
		{CategoryID: "cat-1", Amount: -5000, Date: time.Now()},
		{CategoryID: "cat-1", Amount: -2000, Date: time.Now()},
	}, nil)
	mockBudgetLines.On("EnsureLine", mock.Anything, "b-1", "cat-1").Return(nil)
	mockBudgetLines.On("Get", mock.Anything, "b-1", "cat-1").Return(line, nil)
	mockBudgetLines.On("UpdateBudgetedAndBalance", mock.Anything, "b-1", "cat-1", int64(10000), int64(3000)).Return(nil)
	mockBudgetLines.On("ListByBudget", mock.Anything, "b-1").Return([]*domain.BudgetCategoryLine{line}, nil)

	svc := NewBudgetService(mockBudgetRepo, mockAccRepo, mockBudgetAccts, mockBudgetLines, nil, mockTxRepo)
	err := svc.ReconcileFromTransactions(context.Background(), "b-1")
	assert.NoError(t, err)
}

func TestBudgetService_ReconcileFromTransactions_RefreshesExplicitLinesWithoutTx(t *testing.T) {
	mockBudgetRepo := mocks.NewMockBudgetRepository(t)
	mockAccRepo := mocks.NewMockAccountRepository(t)
	mockBudgetAccts := mocks.NewMockBudgetAccountRepository(t)
	mockBudgetLines := mocks.NewMockBudgetCategoryLineRepository(t)
	mockTxRepo := mocks.NewMockTransactionRepository(t)

	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodZeroSum}
	line := &domain.BudgetCategoryLine{
		BudgetID:   "b-1",
		CategoryID: "cat-mortgage",
		Budgeted:   50000,
	}

	mockBudgetRepo.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockBudgetAccts.On("ListByBudget", mock.Anything, "b-1").Return([]string{"acc-1"}, nil)
	mockTxRepo.On("ListByAccount", mock.Anything, "acc-1").Return([]*domain.Transaction{}, nil)
	mockBudgetLines.On("ListByBudget", mock.Anything, "b-1").Return([]*domain.BudgetCategoryLine{line}, nil)
	mockBudgetLines.On("UpdateBudgetedAndBalance", mock.Anything, "b-1", "cat-mortgage", int64(50000), int64(50000)).Return(nil)

	svc := NewBudgetService(mockBudgetRepo, mockAccRepo, mockBudgetAccts, mockBudgetLines, nil, mockTxRepo)
	err := svc.ReconcileFromTransactions(context.Background(), "b-1")
	assert.NoError(t, err)
}

func TestBudgetService_AddCategoryToBudget(t *testing.T) {
	mockBudgetRepo := mocks.NewMockBudgetRepository(t)
	mockAccRepo := mocks.NewMockAccountRepository(t)
	mockBudgetAccts := mocks.NewMockBudgetAccountRepository(t)
	mockBudgetLines := mocks.NewMockBudgetCategoryLineRepository(t)
	mockTxRepo := mocks.NewMockTransactionRepository(t)

	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodZeroSum}
	available := []*domain.Category{{ID: "cat-mortgage", Name: "Mortgage", Type: domain.CategoryExpense}}
	result := []*domain.BudgetCategory{{
		Category: domain.Category{ID: "cat-mortgage", Name: "Mortgage", Type: domain.CategoryExpense},
	}}

	mockBudgetRepo.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockBudgetLines.On("Get", mock.Anything, "b-1", "cat-mortgage").Return(nil, errors.New("budget category line not found"))
	mockBudgetLines.On("ListAvailableCategories", mock.Anything, "b-1").Return(available, nil)
	mockBudgetLines.On("EnsureLine", mock.Anything, "b-1", "cat-mortgage").Return(nil)
	mockBudgetLines.On("ListBudgetCategories", mock.Anything, "b-1").Return(result, nil)

	svc := NewBudgetService(mockBudgetRepo, mockAccRepo, mockBudgetAccts, mockBudgetLines, nil, mockTxRepo)
	got, err := svc.AddCategoryToBudget(context.Background(), "b-1", "cat-mortgage")
	assert.NoError(t, err)
	assert.Equal(t, "cat-mortgage", got.ID)
	assert.Equal(t, "Mortgage", got.Name)
}

func TestBudgetService_AddCategoryToBudget_AlreadyInBudget(t *testing.T) {
	mockBudgetRepo := mocks.NewMockBudgetRepository(t)
	mockAccRepo := mocks.NewMockAccountRepository(t)
	mockBudgetAccts := mocks.NewMockBudgetAccountRepository(t)
	mockBudgetLines := mocks.NewMockBudgetCategoryLineRepository(t)
	mockTxRepo := mocks.NewMockTransactionRepository(t)

	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodZeroSum}
	existing := &domain.BudgetCategoryLine{BudgetID: "b-1", CategoryID: "cat-1"}

	mockBudgetRepo.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockBudgetLines.On("Get", mock.Anything, "b-1", "cat-1").Return(existing, nil)

	svc := NewBudgetService(mockBudgetRepo, mockAccRepo, mockBudgetAccts, mockBudgetLines, nil, mockTxRepo)
	_, err := svc.AddCategoryToBudget(context.Background(), "b-1", "cat-1")
	assert.ErrorIs(t, err, ErrConflict)
}
