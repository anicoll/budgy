package api

import (
	"encoding/json"
	"net/http"

	"budgeting_system/internal/storage"
)

// APIServer coordinates request routing and data storage handlers.
type APIServer struct {
	budgets      storage.BudgetRepository
	accounts     storage.AccountRepository
	categories   storage.CategoryRepository
	transactions storage.TransactionRepository
	users        storage.UserRepository
}

// NewAPIServer creates a new APIServer with repository dependencies.
func NewAPIServer(
	budgets storage.BudgetRepository,
	accounts storage.AccountRepository,
	categories storage.CategoryRepository,
	transactions storage.TransactionRepository,
	users storage.UserRepository,
) *APIServer {
	return &APIServer{
		budgets:      budgets,
		accounts:     accounts,
		categories:   categories,
		transactions: transactions,
		users:        users,
	}
}

// Routes configures the HTTP multiplexer with all API paths.
func (s *APIServer) Routes() *http.ServeMux {
	mux := http.NewServeMux()

	// Public Auth handlers
	mux.HandleFunc("POST /api/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)

	// Secure Auth handlers
	s.handleSecure(mux, "GET /api/auth/me", s.handleMe)
	s.handleSecure(mux, "POST /api/auth/logout", s.handleLogout)

	// Budget handlers
	s.handleSecure(mux, "POST /api/budgets", s.handleCreateBudget)
	s.handleSecure(mux, "GET /api/budgets", s.handleListBudgets)
	s.handleSecure(mux, "GET /api/budgets/{id}", s.handleGetBudget)
	s.handleSecure(mux, "GET /api/budgets/{id}/summary", s.handleGetBudgetSummary)
	s.handleSecure(mux, "PUT /api/budgets/{id}", s.handleUpdateBudget)
	s.handleSecure(mux, "DELETE /api/budgets/{id}", s.handleDeleteBudget)

	// Account handlers
	s.handleSecure(mux, "POST /api/budgets/{id}/accounts", s.handleCreateAccount)
	s.handleSecure(mux, "GET /api/budgets/{id}/accounts", s.handleListAccounts)
	s.handleSecure(mux, "PUT /api/budgets/{id}/accounts/{acc_id}", s.handleUpdateAccount)
	s.handleSecure(mux, "DELETE /api/budgets/{id}/accounts/{acc_id}", s.handleDeleteAccount)

	// Category/Envelope handlers
	s.handleSecure(mux, "POST /api/budgets/{id}/categories", s.handleCreateCategory)
	s.handleSecure(mux, "GET /api/budgets/{id}/categories", s.handleListCategories)
	s.handleSecure(mux, "POST /api/budgets/{id}/categories/{cat_id}/assign", s.handleAssignCategoryFunds)
	s.handleSecure(mux, "POST /api/budgets/{id}/categories/{cat_id}/fund", s.handleFundEnvelope)
	s.handleSecure(mux, "PUT /api/budgets/{id}/categories/{cat_id}", s.handleUpdateCategory)
	s.handleSecure(mux, "DELETE /api/budgets/{id}/categories/{cat_id}", s.handleDeleteCategory)

	// Transaction handlers
	s.handleSecure(mux, "POST /api/budgets/{id}/transactions", s.handleCreateTransaction)
	s.handleSecure(mux, "GET /api/budgets/{id}/transactions", s.handleListTransactions)
	s.handleSecure(mux, "PUT /api/budgets/{id}/transactions/{tx_id}", s.handleUpdateTransaction)
	s.handleSecure(mux, "DELETE /api/budgets/{id}/transactions/{tx_id}", s.handleDeleteTransaction)

	return mux
}

// JSON utilities for REST responses

func (s *APIServer) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

func (s *APIServer) respondError(w http.ResponseWriter, status int, message string) {
	s.respondJSON(w, status, map[string]string{"error": message})
}
