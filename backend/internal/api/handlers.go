package api

import (
	"context"
	"errors"
	"time"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/service"
)

// Budget Handlers

func (s *APIServer) handleCreateBudget(ctx context.Context, req CreateBudgetRequest) (BudgetResponse, error) {
	userID := getUserID(ctx)
	if userID == "" {
		return BudgetResponse{}, service.ErrUnauthorized
	}

	b, err := s.budgets.Create(ctx, userID, req.Name, req.Method, req.Currency)
	if err != nil {
		return BudgetResponse{}, err
	}

	return ToBudgetResponse(b), nil
}

func (s *APIServer) handleListBudgets(ctx context.Context, _ struct{}) ([]BudgetResponse, error) {
	userID := getUserID(ctx)
	if userID == "" {
		return nil, service.ErrUnauthorized
	}

	list, err := s.budgets.List(ctx, userID)
	if err != nil {
		return nil, err
	}

	return ToBudgetListResponse(list), nil
}

func (s *APIServer) handleGetBudget(ctx context.Context, _ struct{}) (BudgetResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return BudgetResponse{}, service.ErrNotFound
	}
	return ToBudgetResponse(b), nil
}

func (s *APIServer) handleGetBudgetSummary(ctx context.Context, _ struct{}) (interface{}, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return nil, service.ErrNotFound
	}

	summary, err := s.budgets.GetSummary(ctx, b.ID)
	if err != nil {
		return nil, err
	}

	return summary, nil
}

func (s *APIServer) handleUpdateBudget(ctx context.Context, req UpdateBudgetRequest) (BudgetResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return BudgetResponse{}, service.ErrNotFound
	}

	updated, err := s.budgets.Update(ctx, b.ID, req.Name, req.Method, req.Currency)
	if err != nil {
		return BudgetResponse{}, err
	}

	return ToBudgetResponse(updated), nil
}

func (s *APIServer) handleDeleteBudget(ctx context.Context, _ struct{}) (map[string]string, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return nil, service.ErrNotFound
	}

	err := s.budgets.Delete(ctx, b.ID)
	if err != nil {
		return nil, err
	}

	return map[string]string{"message": "budget deleted successfully"}, nil
}

// Account Handlers

func (s *APIServer) handleCreateAccount(ctx context.Context, req CreateAccountRequest) (AccountResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return AccountResponse{}, service.ErrNotFound
	}

	acc, err := s.accounts.Create(ctx, b.ID, req.Name, req.Type, req.Balance)
	if err != nil {
		return AccountResponse{}, err
	}

	return ToAccountResponse(acc), nil
}

func (s *APIServer) handleListAccounts(ctx context.Context, _ struct{}) ([]AccountResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return nil, service.ErrNotFound
	}

	list, err := s.accounts.List(ctx, b.ID)
	if err != nil {
		return nil, err
	}

	return ToAccountListResponse(list), nil
}

func (s *APIServer) handleUpdateAccount(ctx context.Context, req UpdateAccountRequest) (AccountResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return AccountResponse{}, service.ErrNotFound
	}

	accID := PathValue(ctx, "acc_id")
	acc, err := s.accounts.GetByID(ctx, accID)
	if err != nil {
		return AccountResponse{}, err
	}
	if acc.BudgetID != b.ID {
		return AccountResponse{}, service.ErrBadRequest
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

	updated, err := s.accounts.Update(ctx, acc)
	if err != nil {
		return AccountResponse{}, err
	}

	return ToAccountResponse(updated), nil
}

func (s *APIServer) handleDeleteAccount(ctx context.Context, _ struct{}) (map[string]string, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return nil, service.ErrNotFound
	}

	accID := PathValue(ctx, "acc_id")
	acc, err := s.accounts.GetByID(ctx, accID)
	if err != nil {
		return nil, err
	}
	if acc.BudgetID != b.ID {
		return nil, service.ErrBadRequest
	}

	err = s.accounts.Delete(ctx, accID)
	if err != nil {
		return nil, err
	}

	return map[string]string{"message": "account deleted successfully"}, nil
}

// Category / Envelope Handlers

func (s *APIServer) handleCreateCategory(ctx context.Context, req CreateCategoryRequest) (CategoryResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return CategoryResponse{}, service.ErrNotFound
	}

	c, err := s.categories.Create(ctx, b.ID, req.Name, req.TargetLimit)
	if err != nil {
		return CategoryResponse{}, err
	}

	return ToCategoryResponse(c), nil
}

func (s *APIServer) handleListCategories(ctx context.Context, _ struct{}) ([]CategoryResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return nil, service.ErrNotFound
	}

	list, err := s.categories.List(ctx, b.ID)
	if err != nil {
		return nil, err
	}

	return ToCategoryListResponse(list), nil
}

func (s *APIServer) handleAssignCategoryFunds(ctx context.Context, req AssignCategoryFundsRequest) (CategoryResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return CategoryResponse{}, service.ErrNotFound
	}

	catID := PathValue(ctx, "cat_id")
	c, err := s.categories.AssignFunds(ctx, b.ID, catID, req.Amount)
	if err != nil {
		return CategoryResponse{}, err
	}

	return ToCategoryResponse(c), nil
}

func (s *APIServer) handleFundEnvelope(ctx context.Context, req FundEnvelopeRequest) (interface{}, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return nil, service.ErrNotFound
	}

	catID := PathValue(ctx, "cat_id")
	updatedAcc, updatedEnv, err := s.categories.FundEnvelope(ctx, b.ID, catID, req.AccountID, req.Amount)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"account":  ToAccountResponse(updatedAcc),
		"envelope": ToCategoryResponse(updatedEnv),
	}, nil
}

func (s *APIServer) handleUpdateCategory(ctx context.Context, req UpdateCategoryRequest) (CategoryResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return CategoryResponse{}, service.ErrNotFound
	}

	catID := PathValue(ctx, "cat_id")
	c, err := s.categories.GetByID(ctx, catID)
	if err != nil {
		return CategoryResponse{}, err
	}
	if c.BudgetID != b.ID {
		return CategoryResponse{}, service.ErrBadRequest
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

	updated, err := s.categories.Update(ctx, c)
	if err != nil {
		return CategoryResponse{}, err
	}

	return ToCategoryResponse(updated), nil
}

func (s *APIServer) handleDeleteCategory(ctx context.Context, _ struct{}) (map[string]string, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return nil, service.ErrNotFound
	}

	catID := PathValue(ctx, "cat_id")
	c, err := s.categories.GetByID(ctx, catID)
	if err != nil {
		return nil, err
	}
	if c.BudgetID != b.ID {
		return nil, service.ErrBadRequest
	}

	err = s.categories.Delete(ctx, catID)
	if err != nil {
		return nil, err
	}

	return map[string]string{"message": "category deleted successfully"}, nil
}

// Transaction Handlers

func (s *APIServer) handleCreateTransaction(ctx context.Context, req CreateTransactionRequest) (TransactionResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return TransactionResponse{}, service.ErrNotFound
	}

	parsedDate, err := time.Parse(time.RFC3339, req.Date)
	if err != nil {
		parsedDate = time.Now()
	}

	tx, err := s.transactions.Create(ctx, b.ID, req.AccountID, req.CategoryID, req.Amount, req.Description, parsedDate)
	if err != nil {
		return TransactionResponse{}, err
	}

	return ToTransactionResponse(tx), nil
}

func (s *APIServer) handleListTransactions(ctx context.Context, _ struct{}) ([]TransactionResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return nil, service.ErrNotFound
	}

	list, err := s.transactions.List(ctx, b.ID)
	if err != nil {
		return nil, err
	}

	return ToTransactionListResponse(list), nil
}

func (s *APIServer) handleUpdateTransaction(ctx context.Context, req UpdateTransactionRequest) (TransactionResponse, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return TransactionResponse{}, service.ErrNotFound
	}

	txID := PathValue(ctx, "tx_id")

	updates := &domain.Transaction{}
	if req.AccountID != nil {
		updates.AccountID = *req.AccountID
	}
	if req.CategoryID != nil {
		updates.CategoryID = *req.CategoryID
	}
	if req.Amount != nil {
		updates.Amount = *req.Amount
	}
	if req.Description != nil {
		updates.Description = *req.Description
	}
	if req.Date != nil {
		if parsedDate, err := time.Parse(time.RFC3339, *req.Date); err == nil {
			updates.Date = parsedDate
		}
	}
	if req.Direction != nil {
		updates.Direction = *req.Direction
	}
	if req.Status != nil {
		updates.Status = *req.Status
	}
	if req.Class != nil {
		updates.Class = *req.Class
	}
	if req.PostDate != nil {
		updates.PostDate = req.PostDate
	}
	if req.SubClass != nil {
		updates.SubClass = *req.SubClass
	}
	if req.RawDescription != nil {
		updates.RawDescription = *req.RawDescription
	}
	if req.MerchantName != nil {
		updates.MerchantName = *req.MerchantName
	}

	updated, err := s.transactions.Update(ctx, b.ID, txID, updates)
	if err != nil {
		return TransactionResponse{}, err
	}

	return ToTransactionResponse(updated), nil
}

func (s *APIServer) handleDeleteTransaction(ctx context.Context, _ struct{}) (map[string]string, error) {
	b := getVerifiedBudget(ctx)
	if b == nil {
		return nil, service.ErrNotFound
	}

	txID := PathValue(ctx, "tx_id")
	err := s.transactions.Delete(ctx, b.ID, txID)
	if err != nil {
		return nil, err
	}

	return map[string]string{"message": "transaction deleted successfully"}, nil
}

// Basiq bank connection handlers

func (s *APIServer) handleBasiqAuthLink(ctx context.Context, _ struct{}) (BasiqAuthLinkResponse, error) {
	userID := getUserID(ctx)
	if userID == "" {
		return BasiqAuthLinkResponse{}, service.ErrUnauthorized
	}

	token, connectURL, err := s.bankSync.GetAuthLink(ctx, userID)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) || errors.Is(err, service.ErrBadRequest) {
			return BasiqAuthLinkResponse{}, err
		}
		return BasiqAuthLinkResponse{}, err
	}

	return BasiqAuthLinkResponse{
		Token:      token,
		ConnectURL: connectURL,
	}, nil
}

func (s *APIServer) handleBasiqSync(ctx context.Context, _ struct{}) (map[string]string, error) {
	userID := getUserID(ctx)
	if userID == "" {
		return nil, service.ErrUnauthorized
	}

	err := s.bankSync.SyncUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	return map[string]string{"message": "Sync completed successfully"}, nil
}
