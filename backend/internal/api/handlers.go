package api

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"budgeting_system/internal/domain"
)

// Helper to generate a unique ID (UUIDv4 format)
func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func (s *APIServer) verifyBudgetOwnership(w http.ResponseWriter, r *http.Request, budgetID string) (*domain.Budget, bool) {
	b, err := s.budgets.GetByID(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "budget not found")
		return nil, false
	}
	userID := getUserID(r)
	if b.UserID != userID {
		s.respondError(w, http.StatusForbidden, "forbidden")
		return nil, false
	}
	return b, true
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
		UserID:    getUserID(r),
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
	list, err := s.budgets.List(r.Context(), getUserID(r))
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *APIServer) handleGetBudget(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, ok := s.verifyBudgetOwnership(w, r, id)
	if !ok {
		return
	}
	s.respondJSON(w, http.StatusOK, b)
}

func (s *APIServer) handleGetBudgetSummary(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, ok := s.verifyBudgetOwnership(w, r, id)
	if !ok {
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
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
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
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
		return
	}
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
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
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
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
		return
	}
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

	b, ok := s.verifyBudgetOwnership(w, r, budgetID)
	if !ok {
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
	if cat.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "category does not belong to budget")
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

	b, ok := s.verifyBudgetOwnership(w, r, budgetID)
	if !ok {
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
	if acc.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "account does not belong to budget")
		return
	}

	cat, err := s.categories.GetByID(r.Context(), catID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "envelope not found")
		return
	}
	if cat.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "envelope does not belong to budget")
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
	b, ok := s.verifyBudgetOwnership(w, r, budgetID)
	if !ok {
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
	if acc.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "account does not belong to budget")
		return
	}

	var cat *domain.Category
	if req.CategoryID != "" {
		cat, err = s.categories.GetByID(r.Context(), req.CategoryID)
		if err != nil {
			s.respondError(w, http.StatusNotFound, "category not found")
			return
		}
		if cat.BudgetID != budgetID {
			s.respondError(w, http.StatusBadRequest, "category does not belong to budget")
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
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
		return
	}
	list, err := s.transactions.ListByBudget(r.Context(), budgetID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *APIServer) handleUpdateBudget(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, ok := s.verifyBudgetOwnership(w, r, id)
	if !ok {
		return
	}

	var req struct {
		Name     string              `json:"name"`
		Method   domain.BudgetMethod `json:"method"`
		Currency string              `json:"currency"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != "" {
		b.Name = req.Name
	}
	if req.Method != "" {
		b.Method = req.Method
	}
	if req.Currency != "" {
		b.Currency = req.Currency
	}
	b.UpdatedAt = time.Now()

	if err := b.Validate(); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := s.budgets.Update(r.Context(), b); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondJSON(w, http.StatusOK, b)
}

func (s *APIServer) handleDeleteBudget(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := s.verifyBudgetOwnership(w, r, id); !ok {
		return
	}
	if err := s.budgets.Delete(r.Context(), id); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]string{"message": "budget deleted successfully"})
}

func (s *APIServer) handleUpdateAccount(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
		return
	}
	accID := r.PathValue("acc_id")
	acc, err := s.accounts.GetByID(r.Context(), accID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "account not found")
		return
	}
	if acc.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "account does not belong to budget")
		return
	}

	var req struct {
		Name           *string             `json:"name"`
		Type           *domain.AccountType `json:"type"`
		Balance        *int64              `json:"balance"`
		Class          *string             `json:"class"`
		AccountNo      *string             `json:"account_no"`
		AvailableFunds *int64              `json:"available_funds"`
		Product        *string             `json:"product"`
		InstitutionID  *string             `json:"institution_id"`
		ConnectionID   *string             `json:"connection_id"`
		LastUpdated    *time.Time          `json:"last_updated"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		acc.Name = *req.Name
	}
	if req.Type != nil {
		acc.Type = *req.Type
	}
	if req.Balance != nil {
		acc.Balance = *req.Balance
	}
	if req.Class != nil {
		acc.Class = *req.Class
	}
	if req.AccountNo != nil {
		acc.AccountNo = *req.AccountNo
	}
	if req.AvailableFunds != nil {
		acc.AvailableFunds = req.AvailableFunds
	}
	if req.Product != nil {
		acc.Product = *req.Product
	}
	if req.InstitutionID != nil {
		acc.InstitutionID = *req.InstitutionID
	}
	if req.ConnectionID != nil {
		acc.ConnectionID = *req.ConnectionID
	}
	if req.LastUpdated != nil {
		acc.LastUpdated = req.LastUpdated
	}
	acc.UpdatedAt = time.Now()

	if err := acc.Validate(); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := s.accounts.Update(r.Context(), acc); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondJSON(w, http.StatusOK, acc)
}

func (s *APIServer) handleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
		return
	}
	accID := r.PathValue("acc_id")
	acc, err := s.accounts.GetByID(r.Context(), accID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "account not found")
		return
	}
	if acc.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "account does not belong to budget")
		return
	}
	if err := s.accounts.Delete(r.Context(), accID); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]string{"message": "account deleted successfully"})
}

func (s *APIServer) handleUpdateCategory(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
		return
	}
	catID := r.PathValue("cat_id")
	c, err := s.categories.GetByID(r.Context(), catID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "category not found")
		return
	}
	if c.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "category does not belong to budget")
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Budgeted    *int64  `json:"budgeted"`
		Balance     *int64  `json:"balance"`
		TargetLimit *int64  `json:"target_limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		c.Name = *req.Name
	}
	if req.Budgeted != nil {
		c.Budgeted = *req.Budgeted
	}
	if req.Balance != nil {
		c.Balance = *req.Balance
	}
	if req.TargetLimit != nil {
		c.TargetLimit = *req.TargetLimit
	}
	c.UpdatedAt = time.Now()

	if err := c.Validate(); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := s.categories.Update(r.Context(), c); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondJSON(w, http.StatusOK, c)
}

func (s *APIServer) handleDeleteCategory(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
		return
	}
	catID := r.PathValue("cat_id")
	c, err := s.categories.GetByID(r.Context(), catID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "category not found")
		return
	}
	if c.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "category does not belong to budget")
		return
	}
	if err := s.categories.Delete(r.Context(), catID); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]string{"message": "category deleted successfully"})
}

func (s *APIServer) handleUpdateTransaction(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
		return
	}
	txID := r.PathValue("tx_id")
	oldTx, err := s.transactions.GetByID(r.Context(), txID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "transaction not found")
		return
	}
	if oldTx.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "transaction does not belong to budget")
		return
	}

	var req struct {
		AccountID      *string    `json:"account_id"`
		CategoryID     *string    `json:"category_id"`
		Amount         *int64     `json:"amount"`
		Description    *string    `json:"description"`
		Date           *string    `json:"date"`
		Direction      *string    `json:"direction"`
		Status         *string    `json:"status"`
		Class          *string    `json:"class"`
		PostDate       *time.Time `json:"post_date"`
		SubClass       *string    `json:"sub_class"`
		RawDescription *string    `json:"raw_description"`
		MerchantName   *string    `json:"merchant_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Prepare updated values
	newAccountID := oldTx.AccountID
	if req.AccountID != nil {
		newAccountID = *req.AccountID
		newAcc, err := s.accounts.GetByID(r.Context(), newAccountID)
		if err != nil {
			s.respondError(w, http.StatusNotFound, "new account not found")
			return
		}
		if newAcc.BudgetID != budgetID {
			s.respondError(w, http.StatusBadRequest, "new account does not belong to budget")
			return
		}
	}
	newCategoryID := oldTx.CategoryID
	if req.CategoryID != nil {
		newCategoryID = *req.CategoryID
		if newCategoryID != "" {
			newCat, err := s.categories.GetByID(r.Context(), newCategoryID)
			if err != nil {
				s.respondError(w, http.StatusNotFound, "new category not found")
				return
			}
			if newCat.BudgetID != budgetID {
				s.respondError(w, http.StatusBadRequest, "new category does not belong to budget")
				return
			}
		}
	}
	newAmount := oldTx.Amount
	if req.Amount != nil {
		newAmount = *req.Amount
	}

	// Calculate changes to account and category balances
	accountChanges := make(map[string]int64)
	categoryChanges := make(map[string]int64)

	accountChanges[oldTx.AccountID] -= oldTx.Amount
	if oldTx.CategoryID != "" {
		categoryChanges[oldTx.CategoryID] -= oldTx.Amount
	}

	accountChanges[newAccountID] += newAmount
	if newCategoryID != "" {
		categoryChanges[newCategoryID] += newAmount
	}

	// Update the transaction object
	tx := *oldTx
	tx.AccountID = newAccountID
	tx.CategoryID = newCategoryID
	tx.Amount = newAmount
	if req.Description != nil {
		tx.Description = *req.Description
	}
	if req.Date != nil {
		if parsedDate, err := time.Parse(time.RFC3339, *req.Date); err == nil {
			tx.Date = parsedDate
		}
	}
	if req.Direction != nil {
		tx.Direction = *req.Direction
	}
	if req.Status != nil {
		tx.Status = *req.Status
	}
	if req.Class != nil {
		tx.Class = *req.Class
	}
	if req.PostDate != nil {
		tx.PostDate = req.PostDate
	}
	if req.SubClass != nil {
		tx.SubClass = *req.SubClass
	}
	if req.RawDescription != nil {
		tx.RawDescription = *req.RawDescription
	}
	if req.MerchantName != nil {
		tx.MerchantName = *req.MerchantName
	}
	tx.UpdatedAt = time.Now()

	if err := tx.Validate(); err != nil {
		s.respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Update the transaction in database first
	if err := s.transactions.Update(r.Context(), &tx); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Persist account balance adjustments
	for accID, delta := range accountChanges {
		if delta != 0 {
			acc, err := s.accounts.GetByID(r.Context(), accID)
			if err != nil {
				s.respondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get account %s: %s", accID, err.Error()))
				return
			}
			acc.Balance += delta
			if err := s.accounts.UpdateBalance(r.Context(), acc.ID, acc.Balance); err != nil {
				s.respondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to update account balance %s: %s", accID, err.Error()))
				return
			}
		}
	}

	// Persist category balance adjustments
	for catID, delta := range categoryChanges {
		if delta != 0 {
			c, err := s.categories.GetByID(r.Context(), catID)
			if err != nil {
				s.respondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get category %s: %s", catID, err.Error()))
				return
			}
			c.Balance += delta
			if err := s.categories.UpdateBudgetedAndBalance(r.Context(), c.ID, c.Budgeted, c.Balance); err != nil {
				s.respondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to update category balance %s: %s", catID, err.Error()))
				return
			}
		}
	}

	s.respondJSON(w, http.StatusOK, tx)
}

func (s *APIServer) handleDeleteTransaction(w http.ResponseWriter, r *http.Request) {
	budgetID := r.PathValue("id")
	if _, ok := s.verifyBudgetOwnership(w, r, budgetID); !ok {
		return
	}
	txID := r.PathValue("tx_id")
	tx, err := s.transactions.GetByID(r.Context(), txID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "transaction not found")
		return
	}
	if tx.BudgetID != budgetID {
		s.respondError(w, http.StatusBadRequest, "transaction does not belong to budget")
		return
	}

	// Calculate changes to account and category balances
	accountChanges := make(map[string]int64)
	categoryChanges := make(map[string]int64)

	accountChanges[tx.AccountID] -= tx.Amount
	if tx.CategoryID != "" {
		categoryChanges[tx.CategoryID] -= tx.Amount
	}

	// Delete transaction
	if err := s.transactions.Delete(r.Context(), txID); err != nil {
		s.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Persist account balance adjustments
	for accID, delta := range accountChanges {
		if delta != 0 {
			acc, err := s.accounts.GetByID(r.Context(), accID)
			if err != nil {
				s.respondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get account %s: %s", accID, err.Error()))
				return
			}
			acc.Balance += delta
			if err := s.accounts.UpdateBalance(r.Context(), acc.ID, acc.Balance); err != nil {
				s.respondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to update account balance %s: %s", accID, err.Error()))
				return
			}
		}
	}

	// Persist category balance adjustments
	for catID, delta := range categoryChanges {
		if delta != 0 {
			c, err := s.categories.GetByID(r.Context(), catID)
			if err != nil {
				s.respondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get category %s: %s", catID, err.Error()))
				return
			}
			c.Balance += delta
			if err := s.categories.UpdateBudgetedAndBalance(r.Context(), c.ID, c.Budgeted, c.Balance); err != nil {
				s.respondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to update category balance %s: %s", catID, err.Error()))
				return
			}
		}
	}

	s.respondJSON(w, http.StatusOK, map[string]string{"message": "transaction deleted successfully"})
}

func (s *APIServer) handleBasiqAuthLink(w http.ResponseWriter, r *http.Request) {
	if s.basiqService == nil {
		s.respondError(w, http.StatusServiceUnavailable, "Basiq service is not configured")
		return
	}

	userID := getUserID(r)
	if userID == "" {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user, err := s.users.GetByID(r.Context(), userID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "user not found")
		return
	}

	basiqUserID := user.BasiqUserID
	if basiqUserID == "" {
		id, err := s.basiqService.CreateBasiqUser(r.Context(), user.Email, user.FirstName, user.LastName)
		if err != nil {
			s.respondError(w, http.StatusInternalServerError, "failed to create Basiq user: "+err.Error())
			return
		}
		basiqUserID = id
		if err := s.users.UpdateBasiqUserID(r.Context(), user.ID, basiqUserID); err != nil {
			s.respondError(w, http.StatusInternalServerError, "failed to save Basiq User ID: "+err.Error())
			return
		}
	}

	token, err := s.basiqService.GetClientToken(r.Context(), basiqUserID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to generate client token: "+err.Error())
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	connectURL := fmt.Sprintf("https://connect.basiq.io/login?code=%s&redirect_url=%s/accounts", token, frontendURL)

	s.respondJSON(w, http.StatusOK, map[string]string{
		"token":       token,
		"connect_url": connectURL,
	})
}

func (s *APIServer) handleBasiqSync(w http.ResponseWriter, r *http.Request) {
	if s.basiqService == nil {
		s.respondError(w, http.StatusServiceUnavailable, "Basiq service is not configured")
		return
	}

	userID := getUserID(r)
	if userID == "" {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user, err := s.users.GetByID(r.Context(), userID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "user not found")
		return
	}

	if user.BasiqUserID == "" {
		s.respondError(w, http.StatusBadRequest, "no connected Basiq account found")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	if err := s.syncBasiqUser(ctx, user.ID, user.BasiqUserID); err != nil {
		s.respondError(w, http.StatusInternalServerError, "sync failed: "+err.Error())
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]string{"message": "Sync completed successfully"})
}

func (s *APIServer) syncBasiqUser(ctx context.Context, userID, basiqUserID string) error {
	if s.basiqService == nil {
		return fmt.Errorf("Basiq service is not configured")
	}

	budgets, err := s.budgets.List(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to list budgets: %w", err)
	}

	var budgetID string
	if len(budgets) == 0 {
		defaultBudget := &domain.Budget{
			ID:        generateID(),
			UserID:    userID,
			Name:      "Default Budget",
			Method:    domain.MethodZeroSum,
			Currency:  "AUD",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		if err := s.budgets.Create(ctx, defaultBudget); err != nil {
			return fmt.Errorf("failed to create default budget: %w", err)
		}
		budgetID = defaultBudget.ID
	} else {
		budgetID = budgets[0].ID
	}

	accounts, transactions, err := s.basiqService.FetchAccountsAndTransactions(ctx, basiqUserID)
	if err != nil {
		return fmt.Errorf("failed to fetch bank data: %w", err)
	}

	for _, acc := range accounts {
		acc.BudgetID = budgetID
		existing, err := s.accounts.GetByID(ctx, acc.ID)
		if err != nil {
			if err := s.accounts.Create(ctx, acc); err != nil {
				return fmt.Errorf("failed to create account %s: %w", acc.ID, err)
			}
		} else {
			existing.Name = acc.Name
			existing.Balance = acc.Balance
			existing.AvailableFunds = acc.AvailableFunds
			existing.Class = acc.Class
			existing.AccountNo = acc.AccountNo
			existing.Product = acc.Product
			existing.InstitutionID = acc.InstitutionID
			existing.ConnectionID = acc.ConnectionID
			existing.LastUpdated = acc.LastUpdated
			existing.UpdatedAt = time.Now()
			if err := s.accounts.Update(ctx, existing); err != nil {
				return fmt.Errorf("failed to update account %s: %w", acc.ID, err)
			}
		}
	}

	for _, tx := range transactions {
		tx.BudgetID = budgetID
		_, err := s.transactions.GetByID(ctx, tx.ID)
		if err != nil {
			if err := s.transactions.Create(ctx, tx); err != nil {
				return fmt.Errorf("failed to create transaction %s: %w", tx.ID, err)
			}
		} else {
			tx.UpdatedAt = time.Now()
			if err := s.transactions.Update(ctx, tx); err != nil {
				return fmt.Errorf("failed to update transaction %s: %w", tx.ID, err)
			}
		}
	}

	return nil
}

