package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/service/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func addAuth(req *http.Request, userID string) {
	token, _ := GenerateJWT(userID)
	req.AddCookie(&http.Cookie{
		Name:  "token",
		Value: token,
	})
}

func TestHandleCreateBudget(t *testing.T) {
	mockBudgetSvc := mocks.NewMockBudgetService(t)
	server := NewAPIServer(nil, mockBudgetSvc, nil, nil, nil, nil)
	mux := server.Routes()

	budget := &domain.Budget{
		ID:        "b-1",
		UserID:    "user-1",
		Name:      "Personal",
		Method:    domain.MethodZeroSum,
		Currency:  "USD",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	mockBudgetSvc.On("Create", mock.Anything, "user-1", "Personal", domain.MethodZeroSum, "USD").Return(budget, nil)

	reqBody := `{"name":"Personal","method":"ZERO_SUM","currency":"USD"}`
	req := httptest.NewRequest("POST", "/api/budgets", bytes.NewBufferString(reqBody))
	addAuth(req, "user-1")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusCreated, rec.Code)

	var res BudgetResponse
	err := json.NewDecoder(rec.Body).Decode(&res)
	assert.NoError(t, err)
	assert.Equal(t, "Personal", res.Name)
	assert.Equal(t, domain.MethodZeroSum, res.Method)
	assert.Equal(t, "user-1", res.UserID)
	assert.Equal(t, "b-1", res.ID)
}

func TestHandleCreateAccount(t *testing.T) {
	mockBudgetSvc := mocks.NewMockBudgetService(t)
	mockAccSvc := mocks.NewMockAccountService(t)
	server := NewAPIServer(nil, mockBudgetSvc, mockAccSvc, nil, nil, nil)
	mux := server.Routes()

	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodZeroSum}
	acc := &domain.Account{
		ID:       "acc-1",
		BudgetID: "b-1",
		Name:     "Checking",
		Type:     domain.AccountChecking,
		Balance:  50000,
	}

	mockBudgetSvc.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockAccSvc.On("Create", mock.Anything, "b-1", "Checking", domain.AccountChecking, int64(50000)).Return(acc, nil)

	reqBody := `{"name":"Checking","type":"CHECKING","balance":50000}`
	req := httptest.NewRequest("POST", "/api/budgets/b-1/accounts", bytes.NewBufferString(reqBody))
	addAuth(req, "user-1")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusCreated, rec.Code)
}

func TestHandleCreateTransaction_ZeroSum(t *testing.T) {
	mockBudgetSvc := mocks.NewMockBudgetService(t)
	mockTxSvc := mocks.NewMockTransactionService(t)
	server := NewAPIServer(nil, mockBudgetSvc, nil, nil, mockTxSvc, nil)
	mux := server.Routes()

	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodZeroSum}
	tx := &domain.Transaction{
		ID:          "tx-1",
		BudgetID:    "b-1",
		AccountID:   "acc-1",
		CategoryID:  "cat-1",
		Amount:      -20000,
		Description: "groceries",
	}

	mockBudgetSvc.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockTxSvc.On("Create", mock.Anything, "b-1", "acc-1", "cat-1", int64(-20000), "groceries", mock.Anything).Return(tx, nil)

	reqBody := `{"account_id":"acc-1","category_id":"cat-1","amount":-20000,"description":"groceries","date":"2026-06-10T19:00:00Z"}`
	req := httptest.NewRequest("POST", "/api/budgets/b-1/transactions", bytes.NewBufferString(reqBody))
	addAuth(req, "user-1")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusCreated, rec.Code)
}

func TestHandleFundEnvelope_Envelope(t *testing.T) {
	mockBudgetSvc := mocks.NewMockBudgetService(t)
	mockCatSvc := mocks.NewMockCategoryService(t)
	server := NewAPIServer(nil, mockBudgetSvc, nil, mockCatSvc, nil, nil)
	mux := server.Routes()

	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodEnvelope}
	acc := &domain.Account{ID: "acc-1", BudgetID: "b-1", Balance: 70000}
	cat := &domain.Category{ID: "cat-1", BudgetID: "b-1", Balance: 40000}

	mockBudgetSvc.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockCatSvc.On("FundEnvelope", mock.Anything, "b-1", "cat-1", "acc-1", int64(30000)).Return(acc, cat, nil)

	reqBody := `{"account_id":"acc-1","amount":30000}`
	req := httptest.NewRequest("POST", "/api/budgets/b-1/categories/cat-1/fund", bytes.NewBufferString(reqBody))
	addAuth(req, "user-1")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}
