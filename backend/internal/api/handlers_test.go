package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"budgeting_system/internal/domain"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock BudgetRepository
type MockBudgetRepository struct {
	mock.Mock
}

func (m *MockBudgetRepository) Create(ctx context.Context, b *domain.Budget) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBudgetRepository) GetByID(ctx context.Context, id string) (*domain.Budget, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Budget), args.Error(1)
}

func (m *MockBudgetRepository) List(ctx context.Context) ([]*domain.Budget, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Budget), args.Error(1)
}

// Mock AccountRepository
type MockAccountRepository struct {
	mock.Mock
}

func (m *MockAccountRepository) Create(ctx context.Context, acc *domain.Account) error {
	args := m.Called(ctx, acc)
	return args.Error(0)
}

func (m *MockAccountRepository) GetByID(ctx context.Context, id string) (*domain.Account, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Account), args.Error(1)
}

func (m *MockAccountRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Account, error) {
	args := m.Called(ctx, budgetID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Account), args.Error(1)
}

func (m *MockAccountRepository) UpdateBalance(ctx context.Context, id string, balance int64) error {
	args := m.Called(ctx, id, balance)
	return args.Error(0)
}

// Mock CategoryRepository
type MockCategoryRepository struct {
	mock.Mock
}

func (m *MockCategoryRepository) Create(ctx context.Context, c *domain.Category) error {
	args := m.Called(ctx, c)
	return args.Error(0)
}

func (m *MockCategoryRepository) GetByID(ctx context.Context, id string) (*domain.Category, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Category), args.Error(1)
}

func (m *MockCategoryRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Category, error) {
	args := m.Called(ctx, budgetID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Category), args.Error(1)
}

func (m *MockCategoryRepository) UpdateBudgetedAndBalance(ctx context.Context, id string, budgeted int64, balance int64) error {
	args := m.Called(ctx, id, budgeted, balance)
	return args.Error(0)
}

// Mock TransactionRepository
type MockTransactionRepository struct {
	mock.Mock
}

func (m *MockTransactionRepository) Create(ctx context.Context, tx *domain.Transaction) error {
	args := m.Called(ctx, tx)
	return args.Error(0)
}

func (m *MockTransactionRepository) GetByID(ctx context.Context, id string) (*domain.Transaction, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Transaction), args.Error(1)
}

func (m *MockTransactionRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Transaction, error) {
	args := m.Called(ctx, budgetID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Transaction), args.Error(1)
}

func (m *MockTransactionRepository) ListByAccount(ctx context.Context, accountID string) ([]*domain.Transaction, error) {
	args := m.Called(ctx, accountID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Transaction), args.Error(1)
}

func (m *MockTransactionRepository) ListByCategory(ctx context.Context, categoryID string) ([]*domain.Transaction, error) {
	args := m.Called(ctx, categoryID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Transaction), args.Error(1)
}

func TestHandleCreateBudget(t *testing.T) {
	mockBudgetRepo := new(MockBudgetRepository)
	server := NewAPIServer(mockBudgetRepo, nil, nil, nil)
	mux := server.Routes()

	reqBody := `{"name":"Personal","method":"ZERO_SUM","currency":"USD"}`
	req := httptest.NewRequest("POST", "/api/budgets", bytes.NewBufferString(reqBody))
	rec := httptest.NewRecorder()

	mockBudgetRepo.On("Create", mock.Anything, mock.AnythingOfType("*domain.Budget")).Return(nil)

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var res domain.Budget
	err := json.NewDecoder(rec.Body).Decode(&res)
	assert.NoError(t, err)
	assert.Equal(t, "Personal", res.Name)
	assert.Equal(t, domain.MethodZeroSum, res.Method)
	assert.NotEmpty(t, res.ID)

	mockBudgetRepo.AssertExpectations(t)
}

func TestHandleCreateAccount(t *testing.T) {
	mockBudgetRepo := new(MockBudgetRepository)
	mockAccRepo := new(MockAccountRepository)
	server := NewAPIServer(mockBudgetRepo, mockAccRepo, nil, nil)
	mux := server.Routes()

	budget := &domain.Budget{ID: "b-1", Method: domain.MethodZeroSum}
	mockBudgetRepo.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockAccRepo.On("Create", mock.Anything, mock.AnythingOfType("*domain.Account")).Return(nil)

	reqBody := `{"name":"Checking","type":"CHECKING","balance":50000}`
	req := httptest.NewRequest("POST", "/api/budgets/b-1/accounts", bytes.NewBufferString(reqBody))
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusCreated, rec.Code)
	mockBudgetRepo.AssertExpectations(t)
	mockAccRepo.AssertExpectations(t)
}

func TestHandleCreateTransaction_ZeroSum(t *testing.T) {
	mockBudgetRepo := new(MockBudgetRepository)
	mockAccRepo := new(MockAccountRepository)
	mockCatRepo := new(MockCategoryRepository)
	mockTxRepo := new(MockTransactionRepository)
	server := NewAPIServer(mockBudgetRepo, mockAccRepo, mockCatRepo, mockTxRepo)
	mux := server.Routes()

	budget := &domain.Budget{ID: "b-1", Method: domain.MethodZeroSum}
	acc := &domain.Account{ID: "acc-1", Balance: 100000}
	cat := &domain.Category{ID: "cat-1", Budgeted: 50000, Balance: 50000}

	mockBudgetRepo.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockAccRepo.On("GetByID", mock.Anything, "acc-1").Return(acc, nil)
	mockCatRepo.On("GetByID", mock.Anything, "cat-1").Return(cat, nil)

	mockTxRepo.On("Create", mock.Anything, mock.AnythingOfType("*domain.Transaction")).Return(nil)
	mockAccRepo.On("UpdateBalance", mock.Anything, "acc-1", int64(80000)).Return(nil)
	mockCatRepo.On("UpdateBudgetedAndBalance", mock.Anything, "cat-1", int64(50000), int64(30000)).Return(nil)

	reqBody := `{"account_id":"acc-1","category_id":"cat-1","amount":-20000,"description":"groceries","date":"2026-06-10T19:00:00Z"}`
	req := httptest.NewRequest("POST", "/api/budgets/b-1/transactions", bytes.NewBufferString(reqBody))
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusCreated, rec.Code)

	mockBudgetRepo.AssertExpectations(t)
	mockAccRepo.AssertExpectations(t)
	mockCatRepo.AssertExpectations(t)
	mockTxRepo.AssertExpectations(t)
}

func TestHandleFundEnvelope_Envelope(t *testing.T) {
	mockBudgetRepo := new(MockBudgetRepository)
	mockAccRepo := new(MockAccountRepository)
	mockCatRepo := new(MockCategoryRepository)
	server := NewAPIServer(mockBudgetRepo, mockAccRepo, mockCatRepo, nil)
	mux := server.Routes()

	budget := &domain.Budget{ID: "b-1", Method: domain.MethodEnvelope}
	acc := &domain.Account{ID: "acc-1", Balance: 100000}
	cat := &domain.Category{ID: "cat-1", Balance: 10000}

	mockBudgetRepo.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockAccRepo.On("GetByID", mock.Anything, "acc-1").Return(acc, nil)
	mockCatRepo.On("GetByID", mock.Anything, "cat-1").Return(cat, nil)

	mockAccRepo.On("UpdateBalance", mock.Anything, "acc-1", int64(70000)).Return(nil)
	mockCatRepo.On("UpdateBudgetedAndBalance", mock.Anything, "cat-1", int64(0), int64(40000)).Return(nil)

	reqBody := `{"account_id":"acc-1","amount":30000}`
	req := httptest.NewRequest("POST", "/api/budgets/b-1/categories/cat-1/fund", bytes.NewBufferString(reqBody))
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	mockBudgetRepo.AssertExpectations(t)
	mockAccRepo.AssertExpectations(t)
	mockCatRepo.AssertExpectations(t)
}
