package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"budgeting_system/internal/domain"
	budgyv1 "budgeting_system/internal/gen/budgy/v1"
	"budgeting_system/internal/gen/budgy/v1/budgyv1connect"
	"budgeting_system/internal/service/mocks"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestHandleCreateBudget(t *testing.T) {
	mockBudgetSvc := mocks.NewMockBudgetService(t)
	server := NewAPIServer(nil, mockBudgetSvc, nil, nil, nil, nil, nil)
	mux := http.NewServeMux()
	server.MountConnectHandlers(mux)
	ts := httptest.NewServer(mux)
	defer ts.Close()

	client := budgyv1connect.NewBudgetServiceClient(ts.Client(), ts.URL)
	budget := &domain.Budget{
		ID: "b-1", UserID: "user-1", Name: "Personal",
		Method: domain.MethodZeroSum, Currency: "USD",
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	mockBudgetSvc.On("Create", mock.Anything, "user-1", "Personal", domain.MethodZeroSum, "USD").Return(budget, nil)

	req := connect.NewRequest(&budgyv1.CreateBudgetRequest{
		Name: "Personal", Method: budgyv1.BudgetMethod_BUDGET_METHOD_ZERO_SUM, Currency: "USD",
	})
	token, _ := GenerateJWT("user-1")
	req.Header().Set("Cookie", "token="+token)

	res, err := client.CreateBudget(context.Background(), req)
	assert.NoError(t, err)
	assert.Equal(t, "Personal", res.Msg.Budget.Name)
}

func TestHandleCreateAccount(t *testing.T) {
	mockAccSvc := mocks.NewMockAccountService(t)
	server := NewAPIServer(nil, nil, mockAccSvc, nil, nil, nil, nil)
	mux := http.NewServeMux()
	server.MountConnectHandlers(mux)
	ts := httptest.NewServer(mux)
	defer ts.Close()

	client := budgyv1connect.NewAccountServiceClient(ts.Client(), ts.URL)
	acc := &domain.Account{
		ID: "acc-1", UserID: "user-1", Name: "Checking",
		Type: domain.AccountChecking, Balance: 50000,
	}
	mockAccSvc.On("Create", mock.Anything, "user-1", "Checking", domain.AccountChecking, int64(50000)).Return(acc, nil)

	req := connect.NewRequest(&budgyv1.CreateAccountRequest{
		Name: "Checking", Type: budgyv1.AccountType_ACCOUNT_TYPE_CHECKING, Balance: 50000,
	})
	token, _ := GenerateJWT("user-1")
	req.Header().Set("Cookie", "token="+token)

	res, err := client.CreateAccount(context.Background(), req)
	assert.NoError(t, err)
	assert.Equal(t, "Checking", res.Msg.Account.Name)
	assert.Equal(t, "user-1", res.Msg.Account.UserId)
}

func TestHandleCreateTransaction_ZeroSum(t *testing.T) {
	mockBudgetSvc := mocks.NewMockBudgetService(t)
	mockTxSvc := mocks.NewMockTransactionService(t)
	server := NewAPIServer(nil, mockBudgetSvc, nil, nil, mockTxSvc, nil, nil)
	mux := http.NewServeMux()
	server.MountConnectHandlers(mux)
	ts := httptest.NewServer(mux)
	defer ts.Close()

	client := budgyv1connect.NewTransactionServiceClient(ts.Client(), ts.URL)
	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodZeroSum}
	tx := &domain.Transaction{
		ID: "tx-1", BudgetID: "b-1", AccountID: "acc-1", CategoryID: "cat-1",
		Amount: -20000, Description: "groceries",
	}
	mockBudgetSvc.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockTxSvc.On("Create", mock.Anything, "b-1", "acc-1", "cat-1", int64(-20000), "groceries", mock.Anything).Return(tx, nil)

	req := connect.NewRequest(&budgyv1.CreateTransactionRequest{
		BudgetId: "b-1", AccountId: "acc-1", CategoryId: "cat-1",
		Amount: -20000, Description: "groceries",
	})
	token, _ := GenerateJWT("user-1")
	req.Header().Set("Cookie", "token="+token)

	res, err := client.CreateTransaction(context.Background(), req)
	assert.NoError(t, err)
	assert.Equal(t, "tx-1", res.Msg.Transaction.Id)
}

func TestHandleFundEnvelope_Envelope(t *testing.T) {
	mockBudgetSvc := mocks.NewMockBudgetService(t)
	server := NewAPIServer(nil, mockBudgetSvc, nil, nil, nil, nil, nil)
	mux := http.NewServeMux()
	server.MountConnectHandlers(mux)
	ts := httptest.NewServer(mux)
	defer ts.Close()

	client := budgyv1connect.NewBudgetServiceClient(ts.Client(), ts.URL)
	budget := &domain.Budget{ID: "b-1", UserID: "user-1", Method: domain.MethodEnvelope}
	acc := &domain.Account{ID: "acc-1", UserID: "user-1", Balance: 70000}
	budgetCat := &domain.BudgetCategory{
		Category: domain.Category{ID: "cat-1", UserID: "user-1", Name: "Groceries"},
		Balance:  40000,
	}
	mockBudgetSvc.On("GetByID", mock.Anything, "b-1").Return(budget, nil)
	mockBudgetSvc.On("FundEnvelope", mock.Anything, "b-1", "cat-1", "acc-1", int64(30000)).Return(acc, budgetCat, nil)

	req := connect.NewRequest(&budgyv1.FundEnvelopeRequest{
		BudgetId: "b-1", CategoryId: "cat-1", AccountId: "acc-1", Amount: 30000,
	})
	token, _ := GenerateJWT("user-1")
	req.Header().Set("Cookie", "token="+token)

	res, err := client.FundEnvelope(context.Background(), req)
	assert.NoError(t, err)
	assert.Equal(t, "acc-1", res.Msg.Result.AccountId)
	assert.Equal(t, int64(40000), res.Msg.Result.Envelope.Balance)
}
