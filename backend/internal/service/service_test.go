package service

import (
	"context"
	"errors"
	"testing"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/domain/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockSeeder struct{}

func (mockSeeder) SeedCategoriesForUser(_ context.Context, _ string) error { return nil }

func TestAuthService_Register(t *testing.T) {
	tests := []struct {
		name        string
		email       string
		password    string
		firstName   string
		lastName    string
		setupMocks  func(m *mocks.MockUserRepository)
		expectedErr error
	}{
		{
			name:      "Success",
			email:     "new@example.com",
			password:  "password123",
			firstName: "John",
			lastName:  "Doe",
			setupMocks: func(m *mocks.MockUserRepository) {
				m.On("GetByEmail", mock.Anything, "new@example.com").Return(nil, errors.New("not found"))
				m.On("Create", mock.Anything, mock.AnythingOfType("*domain.User")).Return(nil)
			},
		},
		{
			name:      "Conflict User Already Exists",
			email:     "exists@example.com",
			password:  "password123",
			firstName: "John",
			lastName:  "Doe",
			setupMocks: func(m *mocks.MockUserRepository) {
				m.On("GetByEmail", mock.Anything, "exists@example.com").Return(&domain.User{ID: "1"}, nil)
			},
			expectedErr: ErrConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := mocks.NewMockUserRepository(t)
			tt.setupMocks(mockRepo)
			svc := NewAuthService(mockRepo, mockSeeder{})
			user, err := svc.Register(context.Background(), tt.email, tt.password, tt.firstName, tt.lastName)
			if tt.expectedErr != nil {
				assert.ErrorIs(t, err, tt.expectedErr)
				assert.Nil(t, user)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.email, user.Email)
			}
		})
	}
}

func TestBudgetService_Create(t *testing.T) {
	mockRepo := mocks.NewMockBudgetRepository(t)
	mockRepo.On("Create", mock.Anything, mock.MatchedBy(func(b *domain.Budget) bool {
		return b.UserID == "user-1" && b.Name == "My Budget"
	})).Return(nil)

	svc := NewBudgetService(mockRepo, nil, nil, nil, nil, nil)
	budget, err := svc.Create(context.Background(), "user-1", "My Budget", domain.MethodZeroSum, "USD")
	assert.NoError(t, err)
	assert.Equal(t, "My Budget", budget.Name)
}

func TestBudgetService_FundEnvelope(t *testing.T) {
	mockBudgetRepo := mocks.NewMockBudgetRepository(t)
	mockAccRepo := mocks.NewMockAccountRepository(t)
	mockBudgetAccts := mocks.NewMockBudgetAccountRepository(t)
	mockBudgetLines := mocks.NewMockBudgetCategoryLineRepository(t)
	mockAllocRepo := mocks.NewMockAllocationRepository(t)
	mockTxRepo := mocks.NewMockTransactionRepository(t)

	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodEnvelope}
	acc := &domain.Account{ID: "acc-1", UserID: "user-1", Balance: 100000}
	budgetCat := &domain.BudgetCategory{
		Category: domain.Category{ID: "cat-1", UserID: "user-1", Name: "Groceries"},
		Balance:  10000,
	}

	mockBudgetRepo.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockAccRepo.On("GetByID", mock.Anything, "acc-1").Return(acc, nil)
	mockBudgetLines.On("ListBudgetCategories", mock.Anything, "b-1").Return([]*domain.BudgetCategory{budgetCat}, nil)
	mockAllocRepo.On("ListByAccount", mock.Anything, "b-1", "acc-1").Return([]*domain.EnvelopeAllocation{}, nil)
	mockTxRepo.On("ListByAccount", mock.Anything, "acc-1").Return([]*domain.Transaction{}, nil)
	mockAllocRepo.On("Get", mock.Anything, "b-1", "acc-1", "cat-1").Return(nil, errors.New("not found"))
	mockAllocRepo.On("Upsert", mock.Anything, mock.AnythingOfType("*domain.EnvelopeAllocation")).Return(nil)
	mockBudgetLines.On("EnsureLine", mock.Anything, "b-1", "cat-1").Return(nil)
	mockBudgetLines.On("UpdateBudgetedAndBalance", mock.Anything, "b-1", "cat-1", int64(0), int64(40000)).Return(nil)

	svc := NewBudgetService(mockBudgetRepo, mockAccRepo, mockBudgetAccts, mockBudgetLines, mockAllocRepo, mockTxRepo)
	updatedAcc, updatedCat, err := svc.FundEnvelope(context.Background(), "b-1", "cat-1", "acc-1", 30000)
	assert.NoError(t, err)
	assert.Equal(t, int64(70000), updatedAcc.Balance)
	assert.Equal(t, int64(40000), updatedCat.Balance)
}
