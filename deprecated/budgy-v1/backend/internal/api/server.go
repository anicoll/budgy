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
	jobQueue     service.JobQueue
	mappers      *Mappers
}

// NewAPIServer creates a new APIServer with injected services.
func NewAPIServer(
	auth service.AuthService,
	budgets service.BudgetService,
	accounts service.AccountService,
	categories service.CategoryService,
	transactions service.TransactionService,
	bankSync service.BankSyncService,
	jobQueue service.JobQueue,
) *APIServer {
	return &APIServer{
		auth:         auth,
		budgets:      budgets,
		accounts:     accounts,
		categories:   categories,
		transactions: transactions,
		bankSync:     bankSync,
		jobQueue:     jobQueue,
		mappers:      InitMappers(),
	}
}

// Routes configures the HTTP multiplexer with all API paths.
func (s *APIServer) Routes() *http.ServeMux {
	mux := http.NewServeMux()

	// Keep Basiq webhook (plain HTTP POST webhook receiver)
	mux.HandleFunc("POST /api/webhooks/basiq", s.handleBasiqWebhook)

	// Connect RPC handlers (protobuf over HTTP POST)
	s.MountConnectHandlers(mux)

	return mux
}
