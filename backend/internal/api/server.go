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
}

// NewAPIServer creates a new APIServer with repository dependencies.
func NewAPIServer(
	budgets storage.BudgetRepository,
	accounts storage.AccountRepository,
	categories storage.CategoryRepository,
	transactions storage.TransactionRepository,
) *APIServer {
	return &APIServer{
		budgets:      budgets,
		accounts:     accounts,
		categories:   categories,
		transactions: transactions,
	}
}

// Routes configures the HTTP multiplexer with all API paths.
func (s *APIServer) Routes() *http.ServeMux {
	mux := http.NewServeMux()

	// Budget handlers
	mux.HandleFunc("POST /api/budgets", s.handleCreateBudget)
	mux.HandleFunc("GET /api/budgets", s.handleListBudgets)
	mux.HandleFunc("GET /api/budgets/{id}", s.handleGetBudget)
	mux.HandleFunc("GET /api/budgets/{id}/summary", s.handleGetBudgetSummary)
	mux.HandleFunc("PUT /api/budgets/{id}", s.handleUpdateBudget)
	mux.HandleFunc("DELETE /api/budgets/{id}", s.handleDeleteBudget)

	// Account handlers
	mux.HandleFunc("POST /api/budgets/{id}/accounts", s.handleCreateAccount)
	mux.HandleFunc("GET /api/budgets/{id}/accounts", s.handleListAccounts)
	mux.HandleFunc("PUT /api/budgets/{id}/accounts/{acc_id}", s.handleUpdateAccount)
	mux.HandleFunc("DELETE /api/budgets/{id}/accounts/{acc_id}", s.handleDeleteAccount)

	// Category/Envelope handlers
	mux.HandleFunc("POST /api/budgets/{id}/categories", s.handleCreateCategory)
	mux.HandleFunc("GET /api/budgets/{id}/categories", s.handleListCategories)
	mux.HandleFunc("POST /api/budgets/{id}/categories/{cat_id}/assign", s.handleAssignCategoryFunds)
	mux.HandleFunc("POST /api/budgets/{id}/categories/{cat_id}/fund", s.handleFundEnvelope)
	mux.HandleFunc("PUT /api/budgets/{id}/categories/{cat_id}", s.handleUpdateCategory)
	mux.HandleFunc("DELETE /api/budgets/{id}/categories/{cat_id}", s.handleDeleteCategory)

	// Transaction handlers
	mux.HandleFunc("POST /api/budgets/{id}/transactions", s.handleCreateTransaction)
	mux.HandleFunc("GET /api/budgets/{id}/transactions", s.handleListTransactions)
	mux.HandleFunc("PUT /api/budgets/{id}/transactions/{tx_id}", s.handleUpdateTransaction)
	mux.HandleFunc("DELETE /api/budgets/{id}/transactions/{tx_id}", s.handleDeleteTransaction)

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
