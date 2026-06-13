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
			expectedErr: nil,
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

			svc := NewAuthService(mockRepo)
			user, err := svc.Register(context.Background(), tt.email, tt.password, tt.firstName, tt.lastName)

			if tt.expectedErr != nil {
				assert.Error(t, err)
				assert.ErrorIs(t, err, tt.expectedErr)
				assert.Nil(t, user)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tt.email, user.Email)
				assert.NotEmpty(t, user.PasswordHash)
			}
		})
	}
}

func TestBudgetService_Create(t *testing.T) {
	tests := []struct {
		name        string
		userID      string
		budgetName  string
		method      domain.BudgetMethod
		currency    string
		setupMocks  func(m *mocks.MockBudgetRepository)
		expectedErr error
	}{
		{
			name:       "Success",
			userID:     "user-1",
			budgetName: "My Budget",
			method:     domain.MethodZeroSum,
			currency:   "USD",
			setupMocks: func(m *mocks.MockBudgetRepository) {
				m.On("Create", mock.Anything, mock.MatchedBy(func(b *domain.Budget) bool {
					return b.UserID == "user-1" && b.Name == "My Budget"
				})).Return(nil)
			},
			expectedErr: nil,
		},
		{
			name:        "Invalid Budget Method",
			userID:      "user-1",
			budgetName:  "My Budget",
			method:      "INVALID",
			currency:    "USD",
			setupMocks:  func(m *mocks.MockBudgetRepository) {},
			expectedErr: ErrBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := mocks.NewMockBudgetRepository(t)
			tt.setupMocks(mockRepo)

			svc := NewBudgetService(mockRepo, nil, nil)
			budget, err := svc.Create(context.Background(), tt.userID, tt.budgetName, tt.method, tt.currency)

			if tt.expectedErr != nil {
				assert.Error(t, err)
				assert.ErrorIs(t, err, tt.expectedErr)
				assert.Nil(t, budget)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, budget)
				assert.Equal(t, tt.budgetName, budget.Name)
			}
		})
	}
}

func TestCategoryService_FundEnvelope(t *testing.T) {
	mockCatRepo := mocks.NewMockCategoryRepository(t)
	mockAccRepo := mocks.NewMockAccountRepository(t)

	acc := &domain.Account{
		ID:       "acc-1",
		BudgetID: "b-1",
		Balance:  100000,
	}
	cat := &domain.Category{
		ID:       "cat-1",
		BudgetID: "b-1",
		Budgeted: 0,
		Balance:  10000,
	}

	mockAccRepo.On("GetByID", mock.Anything, "acc-1").Return(acc, nil)
	mockCatRepo.On("GetByID", mock.Anything, "cat-1").Return(cat, nil)
	mockAccRepo.On("UpdateBalance", mock.Anything, "acc-1", int64(70000)).Return(nil)
	mockCatRepo.On("UpdateBudgetedAndBalance", mock.Anything, "cat-1", int64(0), int64(40000)).Return(nil)

	svc := NewCategoryService(mockCatRepo, mockAccRepo)
	updatedAcc, updatedCat, err := svc.FundEnvelope(context.Background(), "b-1", "cat-1", "acc-1", 30000)

	assert.NoError(t, err)
	assert.Equal(t, int64(70000), updatedAcc.Balance)
	assert.Equal(t, int64(40000), updatedCat.Balance)
}
