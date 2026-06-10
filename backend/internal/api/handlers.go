package api

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"budgeting_system/internal/domain"
)

// Helper to generate a unique ID (UUIDv4 format)
func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// Budget Handlers

func (s *APIServer) handleCreateBudget(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string              `json:"name"`
		Method   domain.BudgetMethod `json:"method"`
		Currency string              `json:"currency"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	b := &domain.Budget{
		ID:        generateID(),
		Name:      req.Name,
		Method:    req.Method,
		Currency:  req.Currency,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := b.Validate(); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := s.budgets.Create(r.Context(), b); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondJSON(w, http.StatusCreated, b)
}

func (s *APIServer) handleListBudgets(w http.ResponseWriter, r *http.Request) {
	list, err := s.budgets.List(r.Context())
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *APIServer) handleGetBudget(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, err := s.budgets.GetByID(r.Context(), id)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "budget not found")
		return
	}
	s.respondJSON(w, http.StatusOK, b)
}

func (s *APIServer) handleGetBudgetSummary(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, err := s.budgets.GetByID(r.Context(), id)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "budget not found")
		return
	}

	accounts, err := s.accounts.ListByBudget(r.Context(), id)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	categories, err := s.categories.ListByBudget(r.Context(), id)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if b.Method == domain.MethodZeroSum {
		summary := domain.CalculateZeroSumSummary(accounts, categories)
		s.respondJSON(w, http.StatusOK, summary)
	} else {
		// Envelope
		summaries := make([]domain.EnvelopeSummary, 0, len(categories))
		for _, cat := range categories {
			summaries = append(summaries, domain.GetEnvelopeSummary(cat))
		}
		s.respondJSON(w, http.StatusOK, summaries)
	}
}

// Account Handlers

func (s *APIServer) handleCreateAccount(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	_, err := s.budgets.GetByID(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "budget not found")
		return
	}

	var req struct {
		Name    string             `json:"name"`
		Type    domain.AccountType `json:"type"`
		Balance int64              `json:"balance"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	acc := &domain.Account{
		ID:        generateID(),
		BudgetID:  budgetID,
		Name:      req.Name,
		Type:      req.Type,
		Balance:   req.Balance,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := acc.Validate(); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := s.accounts.Create(r.Context(), acc); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondJSON(w, http.StatusCreated, acc)
}

func (s *APIServer) handleListAccounts(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	list, err := s.accounts.ListByBudget(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

// Category Handlers

func (s *APIServer) handleCreateCategory(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	_, err := s.budgets.GetByID(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "budget not found")
		return
	}

	var req struct {
		Name        string `json:"name"`
		TargetLimit int64  `json:"target_limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	c := &domain.Category{
		ID:          generateID(),
		BudgetID:    budgetID,
		Name:        req.Name,
		Budgeted:    0,
		Balance:     0,
		TargetLimit: req.TargetLimit,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := c.Validate(); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := s.categories.Create(r.Context(), c); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondJSON(w, http.StatusCreated, c)
}

func (s *APIServer) handleListCategories(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	list, err := s.categories.ListByBudget(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *APIServer) handleAssignCategoryFunds(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	catID := r.PathValue("cat_id")

	b, err := s.budgets.GetByID(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "budget not found")
		return
	}
	if b.Method != domain.MethodZeroSum {
		s.respondError(w, http.StatusBadRequest, "assigning funds is only supported for Zero-Sum budgets")
		return
	}

	cat, err := s.categories.GetByID(r.Context(), catID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "category not found")
		return
	}

	var req struct {
		Amount int64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	accounts, err := s.accounts.ListByBudget(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	categories, err := s.categories.ListByBudget(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	summary := domain.CalculateZeroSumSummary(accounts, categories)
	updatedCat, err := domain.AssignFunds(summary, cat, req.Amount)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	err = s.categories.UpdateBudgetedAndBalance(r.Context(), catID, updatedCat.Budgeted, updatedCat.Balance)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondJSON(w, http.StatusOK, updatedCat)
}

func (s *APIServer) handleFundEnvelope(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	catID := r.PathValue("cat_id")

	b, err := s.budgets.GetByID(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "budget not found")
		return
	}
	if b.Method != domain.MethodEnvelope {
		s.respondError(w, http.StatusBadRequest, "envelope funding is only supported for Envelope budgets")
		return
	}

	var req struct {
		AccountID string `json:"account_id"`
		Amount    int64  `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	acc, err := s.accounts.GetByID(r.Context(), req.AccountID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "account not found")
		return
	}

	cat, err := s.categories.GetByID(r.Context(), catID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "envelope not found")
		return
	}

	updatedAcc, updatedEnv, err := domain.FundEnvelope(acc, cat, req.Amount)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Persist changes
	err = s.accounts.UpdateBalance(r.Context(), acc.ID, updatedAcc.Balance)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	err = s.categories.UpdateBudgetedAndBalance(r.Context(), cat.ID, updatedEnv.Budgeted, updatedEnv.Balance)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"account":  updatedAcc,
		"envelope": updatedEnv,
	})
}

// Transaction Handlers

func (s *APIServer) handleCreateTransaction(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	b, err := s.budgets.GetByID(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "budget not found")
		return
	}

	var req struct {
		AccountID   string `json:"account_id"`
		CategoryID  string `json:"category_id"` // optional
		Amount      int64  `json:"amount"`
		Description string `json:"description"`
		Date        string `json:"date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	acc, err := s.accounts.GetByID(r.Context(), req.AccountID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "account not found")
		return
	}

	var cat *domain.Category
	if req.CategoryID != "" {
		cat, err = s.categories.GetByID(r.Context(), req.CategoryID)
		if err != nil {
			s.respondError(w, http.StatusNotFound, "category not found")
			return
		}
	}

	parsedDate, err := time.Parse(time.RFC3339, req.Date)
	if err != nil {
		parsedDate = time.Now()
	}

	tx := &domain.Transaction{
		ID:          generateID(),
		BudgetID:    budgetID,
		AccountID:   req.AccountID,
		CategoryID:  req.CategoryID,
		Amount:      req.Amount,
		Description: req.Description,
		Date:        parsedDate,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := tx.Validate(); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Domain logic adjustments
	var updatedAcc *domain.Account
	var updatedEnv *domain.Category

	if b.Method == domain.MethodZeroSum {
		updatedAcc = &domain.Account{
			ID:      acc.ID,
			Balance: acc.Balance + req.Amount,
		}
		if cat != nil {
			updatedEnv = &domain.Category{
				ID:       cat.ID,
				Budgeted: cat.Budgeted,
				Balance:  cat.Balance + req.Amount,
			}
		}
	} else {
		// Envelope method
		if cat != nil {
			updatedAcc, updatedEnv, err = domain.SpendFromEnvelope(acc, cat, -req.Amount) // amount is negative for expense
			if err != nil {
				// If amount is positive (inflow to account), we manually adjust
				if req.Amount > 0 {
					updatedAcc = &domain.Account{ID: acc.ID, Balance: acc.Balance + req.Amount}
					updatedEnv = &domain.Category{ID: cat.ID, Budgeted: cat.Budgeted, Balance: cat.Balance + req.Amount}
				} else {
					s.respondError(w, http.StatusBadRequest, err.Error())
					return
				}
			}
		} else {
			// Uncategorized transaction
			updatedAcc = &domain.Account{
				ID:      acc.ID,
				Balance: acc.Balance + req.Amount,
			}
		}
	}

	// Persist transaction
	if err := s.transactions.Create(r.Context(), tx); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Persist account update
	if err := s.accounts.UpdateBalance(r.Context(), acc.ID, updatedAcc.Balance); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Persist category update if any
	if updatedEnv != nil {
		err = s.categories.UpdateBudgetedAndBalance(r.Context(), cat.ID, updatedEnv.Budgeted, updatedEnv.Balance)
		if err != nil {
			s.respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	s.respondJSON(w, http.StatusCreated, tx)
}

func (s *APIServer) handleListTransactions(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	list, err := s.transactions.ListByBudget(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}
