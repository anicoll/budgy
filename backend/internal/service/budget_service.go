package service

import (
	"context"
	"fmt"
	"time"

	"budgeting_system/internal/domain"
)

type budgetService struct {
	budgets      domain.BudgetRepository
	accounts     domain.AccountRepository
	budgetAccts  domain.BudgetAccountRepository
	budgetLines  domain.BudgetCategoryLineRepository
	allocations  domain.AllocationRepository
	transactions domain.TransactionRepository
}

func NewBudgetService(
	budgets domain.BudgetRepository,
	accounts domain.AccountRepository,
	budgetAccts domain.BudgetAccountRepository,
	budgetLines domain.BudgetCategoryLineRepository,
	allocations domain.AllocationRepository,
	transactions domain.TransactionRepository,
) BudgetService {
	return &budgetService{
		budgets:      budgets,
		accounts:     accounts,
		budgetAccts:  budgetAccts,
		budgetLines:  budgetLines,
		allocations:  allocations,
		transactions: transactions,
	}
}

func (s *budgetService) Create(ctx context.Context, userID, name string, method domain.BudgetMethod, currency string) (*domain.Budget, error) {
	b := &domain.Budget{
		ID:        generateID(),
		UserID:    userID,
		Name:      name,
		Method:    method,
		Currency:  currency,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := b.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.budgets.Create(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *budgetService) GetByID(ctx context.Context, id string) (*domain.Budget, error) {
	b, err := s.budgets.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: budget not found", ErrNotFound)
	}
	return b, nil
}

func (s *budgetService) List(ctx context.Context, userID string) ([]*domain.Budget, error) {
	return s.budgets.List(ctx, userID)
}

func (s *budgetService) Update(ctx context.Context, id string, name string, method domain.BudgetMethod, currency string) (*domain.Budget, error) {
	b, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if name != "" {
		b.Name = name
	}
	if method != "" {
		b.Method = method
	}
	if currency != "" {
		b.Currency = currency
	}
	b.UpdatedAt = time.Now()
	if err := b.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.budgets.Update(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *budgetService) Delete(ctx context.Context, id string) error {
	if _, err := s.GetByID(ctx, id); err != nil {
		return err
	}
	return s.budgets.Delete(ctx, id)
}

func (s *budgetService) GetSummary(ctx context.Context, id string) (any, error) {
	b, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	accounts, err := s.budgetAccts.ListAccountsByBudget(ctx, id)
	if err != nil {
		return nil, err
	}

	categories, err := s.budgetLines.ListBudgetCategories(ctx, id)
	if err != nil {
		return nil, err
	}

	if b.Method == domain.MethodZeroSum {
		return domain.CalculateZeroSumSummary(accounts, categories), nil
	}

	summaries := make([]domain.EnvelopeSummary, 0, len(categories))
	for _, cat := range categories {
		summaries = append(summaries, domain.GetEnvelopeSummary(cat))
	}
	return summaries, nil
}

func (s *budgetService) ListBudgetCategories(ctx context.Context, budgetID string) ([]*domain.BudgetCategory, error) {
	if _, err := s.GetByID(ctx, budgetID); err != nil {
		return nil, err
	}
	return s.budgetLines.ListBudgetCategories(ctx, budgetID)
}

func (s *budgetService) AssignCategoryFunds(ctx context.Context, budgetID, catID string, amount int64) (*domain.BudgetCategory, error) {
	b, err := s.GetByID(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	cat, err := s.budgetLines.ListBudgetCategories(ctx, budgetID)
	if err != nil {
		return nil, err
	}
	var target *domain.BudgetCategory
	for _, c := range cat {
		if c.ID == catID {
			target = c
			break
		}
	}
	if target == nil {
		return nil, fmt.Errorf("%w: category not found", ErrNotFound)
	}

	accounts, err := s.budgetAccts.ListAccountsByBudget(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	summary := domain.CalculateZeroSumSummary(accounts, cat)
	updated, err := domain.AssignFunds(summary, target, amount)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}

	if err := s.budgetLines.EnsureLine(ctx, budgetID, catID); err != nil {
		return nil, err
	}
	if err := s.budgetLines.UpdateBudgetedAndBalance(ctx, budgetID, catID, updated.Budgeted, updated.Balance); err != nil {
		return nil, err
	}
	_ = b
	return updated, nil
}

func (s *budgetService) FundEnvelope(ctx context.Context, budgetID, catID, accountID string, amount int64) (*domain.Account, *domain.BudgetCategory, error) {
	if _, err := s.GetByID(ctx, budgetID); err != nil {
		return nil, nil, err
	}

	acc, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: account not found", ErrNotFound)
	}

	categories, err := s.budgetLines.ListBudgetCategories(ctx, budgetID)
	if err != nil {
		return nil, nil, err
	}
	var cat *domain.BudgetCategory
	for _, c := range categories {
		if c.ID == catID {
			cat = c
			break
		}
	}
	if cat == nil {
		return nil, nil, fmt.Errorf("%w: category not found", ErrNotFound)
	}

	unallocated, err := s.calculateUnallocated(ctx, budgetID, acc)
	if err != nil {
		return nil, nil, err
	}
	if unallocated < amount {
		return nil, nil, fmt.Errorf("%w: insufficient funds in the account to fund the envelope", ErrBadRequest)
	}

	alloc, err := s.allocations.Get(ctx, budgetID, accountID, catID)
	if err != nil {
		alloc = &domain.EnvelopeAllocation{
			BudgetID:   budgetID,
			AccountID:  accountID,
			CategoryID: catID,
			Amount:     amount,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
	} else {
		alloc.Amount += amount
		alloc.UpdatedAt = time.Now()
	}
	if err := s.allocations.Upsert(ctx, alloc); err != nil {
		return nil, nil, err
	}

	updatedEnv := *cat
	updatedEnv.Balance += amount
	if err := s.budgetLines.EnsureLine(ctx, budgetID, catID); err != nil {
		return nil, nil, err
	}
	if err := s.budgetLines.UpdateBudgetedAndBalance(ctx, budgetID, catID, updatedEnv.Budgeted, updatedEnv.Balance); err != nil {
		return nil, nil, err
	}

	updatedAcc := *acc
	updatedAcc.Balance = unallocated - amount
	return &updatedAcc, &updatedEnv, nil
}

func (s *budgetService) calculateUnallocated(ctx context.Context, budgetID string, acc *domain.Account) (int64, error) {
	allocs, err := s.allocations.ListByAccount(ctx, budgetID, acc.ID)
	if err != nil {
		return 0, err
	}
	var totalAllocated int64
	for _, a := range allocs {
		totalAllocated += a.Amount
	}
	txs, err := s.transactions.ListByAccount(ctx, acc.ID)
	if err != nil {
		return 0, err
	}
	var totalSpent int64
	for _, tx := range txs {
		if tx.CategoryID != "" {
			totalSpent += tx.Amount
		}
	}
	return acc.Balance - totalAllocated - totalSpent, nil
}
