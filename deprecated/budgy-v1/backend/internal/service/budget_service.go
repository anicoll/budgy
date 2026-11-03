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

func (s *budgetService) Delete(ctx context.Context, id string) error {
	if _, err := s.GetByID(ctx, id); err != nil {
		return err
	}
	return s.budgets.Delete(ctx, id)
}

func (s *budgetService) ListBudgetCategories(ctx context.Context, budgetID string) ([]*domain.BudgetCategory, error) {
	if _, err := s.GetByID(ctx, budgetID); err != nil {
		return nil, err
	}
	return s.budgetLines.ListBudgetCategories(ctx, budgetID)
}

func (s *budgetService) ListAvailableCategories(ctx context.Context, budgetID string) ([]*domain.Category, error) {
	if _, err := s.GetByID(ctx, budgetID); err != nil {
		return nil, err
	}
	return s.budgetLines.ListAvailableCategories(ctx, budgetID)
}

func (s *budgetService) AddCategoryToBudget(ctx context.Context, budgetID, catID string) (*domain.BudgetCategory, error) {
	if _, err := s.GetByID(ctx, budgetID); err != nil {
		return nil, err
	}

	if _, err := s.budgetLines.Get(ctx, budgetID, catID); err == nil {
		return nil, fmt.Errorf("%w: category already in budget", ErrConflict)
	}

	available, err := s.budgetLines.ListAvailableCategories(ctx, budgetID)
	if err != nil {
		return nil, err
	}
	found := false
	for _, c := range available {
		if c.ID == catID {
			found = true
			break
		}
	}
	if !found {
		return nil, fmt.Errorf("%w: category not found", ErrNotFound)
	}

	if err := s.budgetLines.EnsureLine(ctx, budgetID, catID); err != nil {
		return nil, err
	}
	return s.getBudgetCategory(ctx, budgetID, catID)
}

func (s *budgetService) Create(ctx context.Context, userID, name string, method domain.BudgetMethod, currency string, period domain.BudgetPeriod, startDate string) (*domain.Budget, error) {
	if method == "" {
		method = domain.MethodZeroSum
	}
	if period == "" {
		period = domain.PeriodMonthly
	}
	if startDate == "" {
		startDate = time.Now().Format("2006-01-02")
	}
	b := &domain.Budget{
		ID:        generateID(),
		UserID:    userID,
		Name:      name,
		Method:    method,
		Currency:  currency,
		Period:    period,
		StartDate: startDate,
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

func (s *budgetService) Update(ctx context.Context, id string, name string, method domain.BudgetMethod, currency string, period domain.BudgetPeriod, startDate string) (*domain.Budget, error) {
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
	if period != "" {
		b.Period = period
	}
	if startDate != "" {
		b.StartDate = startDate
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

	_ = b
	return domain.CalculateZeroSumSummary(accounts, categories), nil
}

func (s *budgetService) AssignCategoryFunds(ctx context.Context, budgetID, catID string, amount int64, frequency domain.BudgetFrequency, replace bool) (*domain.BudgetCategory, error) {
	if _, err := s.GetByID(ctx, budgetID); err != nil {
		return nil, err
	}
	if amount < 0 {
		return nil, fmt.Errorf("%w: cannot assign a negative amount", ErrBadRequest)
	}
	if frequency == "" {
		frequency = domain.FrequencyMonthly
	}

	categories, err := s.budgetLines.ListBudgetCategories(ctx, budgetID)
	if err != nil {
		return nil, err
	}
	var target *domain.BudgetCategory
	for _, c := range categories {
		if c.ID == catID {
			target = c
			break
		}
	}
	if target == nil {
		return nil, fmt.Errorf("%w: category not found", ErrNotFound)
	}

	newBudgeted := target.Budgeted + amount
	if replace {
		newBudgeted = amount
	}
	if err := s.budgetLines.EnsureLine(ctx, budgetID, catID); err != nil {
		return nil, err
	}
	if err := s.budgetLines.UpdateBudgeted(ctx, budgetID, catID, newBudgeted, frequency); err != nil {
		return nil, err
	}
	if err := s.ReconcileFromTransactions(ctx, budgetID); err != nil {
		return nil, err
	}

	updated, err := s.getBudgetCategory(ctx, budgetID, catID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *budgetService) FundEnvelope(ctx context.Context, budgetID, catID, accountID string, amount int64) (*domain.Account, *domain.BudgetCategory, error) {
	return nil, nil, fmt.Errorf("%w: envelope budgeting is no longer supported", ErrBadRequest)
}

func (s *budgetService) getBudgetCategory(ctx context.Context, budgetID, catID string) (*domain.BudgetCategory, error) {
	categories, err := s.budgetLines.ListBudgetCategories(ctx, budgetID)
	if err != nil {
		return nil, err
	}
	for _, c := range categories {
		if c.ID == catID {
			return c, nil
		}
	}
	return nil, fmt.Errorf("%w: category not found", ErrNotFound)
}
