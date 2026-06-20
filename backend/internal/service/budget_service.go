package service

import (
	"context"
	"fmt"
	"time"

	"budgeting_system/internal/domain"
)

type budgetService struct {
	budgets    domain.BudgetRepository
	accounts   domain.AccountRepository
	categories domain.CategoryRepository
}

func NewBudgetService(budgets domain.BudgetRepository, accounts domain.AccountRepository, categories domain.CategoryRepository) BudgetService {
	return &budgetService{budgets: budgets, accounts: accounts, categories: categories}
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
	_, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.budgets.Delete(ctx, id)
}

func (s *budgetService) GetSummary(ctx context.Context, id string) (any, error) {
	b, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	accounts, err := s.accounts.ListByBudget(ctx, id)
	if err != nil {
		return nil, err
	}

	categories, err := s.categories.ListByBudget(ctx, id)
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
