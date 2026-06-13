package api

import (
	"net/http"

	"budgeting_system/internal/service"
)

// APIServer coordinates request routing and application service execution.
type APIServer struct {
	auth         service.AuthService
	budgets      service.BudgetService
	accounts     service.AccountService
	categories   service.CategoryService
	transactions service.TransactionService
	bankSync     service.BankSyncService
}

// NewAPIServer creates a new APIServer with injected services.
func NewAPIServer(
	auth service.AuthService,
	budgets service.BudgetService,
	accounts service.AccountService,
	categories service.CategoryService,
	transactions service.TransactionService,
	bankSync service.BankSyncService,
) *APIServer {
	return &APIServer{
		auth:         auth,
		budgets:      budgets,
		accounts:     accounts,
		categories:   categories,
		transactions: transactions,
		bankSync:     bankSync,
	}
}

// Routes configures the HTTP multiplexer with all API paths.
func (s *APIServer) Routes() *http.ServeMux {
	mux := http.NewServeMux()

	// Public Auth handlers
	mux.HandleFunc("POST /api/auth/register", MakeHandler(s.handleRegister))
	mux.HandleFunc("POST /api/auth/login", MakeHandler(s.handleLogin))
	mux.HandleFunc("POST /api/webhooks/basiq", s.handleBasiqWebhook) // Webhooks verify signatures customly

	// Secure Auth handlers
	s.handleSecure(mux, "GET /api/auth/me", MakeHandler(s.handleMe))
	s.handleSecure(mux, "POST /api/auth/logout", s.handleLogout) // Sets cookies directly

	// Basiq bank connection handlers
	s.handleSecure(mux, "GET /api/basiq/auth-link", MakeHandler(s.handleBasiqAuthLink))
	s.handleSecure(mux, "POST /api/basiq/sync", MakeHandler(s.handleBasiqSync))

	// Budget handlers
	s.handleSecure(mux, "POST /api/budgets", MakeHandler(s.handleCreateBudget))
	s.handleSecure(mux, "GET /api/budgets", MakeHandler(s.handleListBudgets))
	s.handleBudgetSecure(mux, "GET /api/budgets/{id}", MakeHandler(s.handleGetBudget))
	s.handleBudgetSecure(mux, "GET /api/budgets/{id}/summary", MakeHandler(s.handleGetBudgetSummary))
	s.handleBudgetSecure(mux, "PUT /api/budgets/{id}", MakeHandler(s.handleUpdateBudget))
	s.handleBudgetSecure(mux, "DELETE /api/budgets/{id}", MakeHandler(s.handleDeleteBudget))

	// Account handlers
	s.handleBudgetSecure(mux, "POST /api/budgets/{id}/accounts", MakeHandler(s.handleCreateAccount))
	s.handleBudgetSecure(mux, "GET /api/budgets/{id}/accounts", MakeHandler(s.handleListAccounts))
	s.handleBudgetSecure(mux, "PUT /api/budgets/{id}/accounts/{acc_id}", MakeHandler(s.handleUpdateAccount))
	s.handleBudgetSecure(mux, "DELETE /api/budgets/{id}/accounts/{acc_id}", MakeHandler(s.handleDeleteAccount))

	// Category/Envelope handlers
	s.handleBudgetSecure(mux, "POST /api/budgets/{id}/categories", MakeHandler(s.handleCreateCategory))
	s.handleBudgetSecure(mux, "GET /api/budgets/{id}/categories", MakeHandler(s.handleListCategories))
	s.handleBudgetSecure(mux, "POST /api/budgets/{id}/categories/{cat_id}/assign", MakeHandler(s.handleAssignCategoryFunds))
	s.handleBudgetSecure(mux, "POST /api/budgets/{id}/categories/{cat_id}/fund", MakeHandler(s.handleFundEnvelope))
	s.handleBudgetSecure(mux, "PUT /api/budgets/{id}/categories/{cat_id}", MakeHandler(s.handleUpdateCategory))
	s.handleBudgetSecure(mux, "DELETE /api/budgets/{id}/categories/{cat_id}", MakeHandler(s.handleDeleteCategory))

	// Transaction handlers
	s.handleBudgetSecure(mux, "POST /api/budgets/{id}/transactions", MakeHandler(s.handleCreateTransaction))
	s.handleBudgetSecure(mux, "GET /api/budgets/{id}/transactions", MakeHandler(s.handleListTransactions))
	s.handleBudgetSecure(mux, "PUT /api/budgets/{id}/transactions/{tx_id}", MakeHandler(s.handleUpdateTransaction))
	s.handleBudgetSecure(mux, "DELETE /api/budgets/{id}/transactions/{tx_id}", MakeHandler(s.handleDeleteTransaction))

	return mux
}
