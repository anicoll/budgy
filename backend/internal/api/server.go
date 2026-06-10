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

	// Account handlers
	mux.HandleFunc("POST /api/budgets/{id}/accounts", s.handleCreateAccount)
	mux.HandleFunc("GET /api/budgets/{id}/accounts", s.handleListAccounts)

	// Category/Envelope handlers
	mux.HandleFunc("POST /api/budgets/{id}/categories", s.handleCreateCategory)
	mux.HandleFunc("GET /api/budgets/{id}/categories", s.handleListCategories)
	mux.HandleFunc("POST /api/budgets/{id}/categories/{cat_id}/assign", s.handleAssignCategoryFunds)
	mux.HandleFunc("POST /api/budgets/{id}/categories/{cat_id}/fund", s.handleFundEnvelope)

	// Transaction handlers
	mux.HandleFunc("POST /api/budgets/{id}/transactions", s.handleCreateTransaction)
	mux.HandleFunc("GET /api/budgets/{id}/transactions", s.handleListTransactions)

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
