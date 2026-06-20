package service

import (
	"context"
	"fmt"
	"time"

	"budgeting_system/internal/domain"
)

type accountService struct {
	accounts     domain.AccountRepository
	budgets      domain.BudgetRepository
	allocations  domain.AllocationRepository
	transactions domain.TransactionRepository
}

func NewAccountService(
	accounts domain.AccountRepository,
	budgets domain.BudgetRepository,
	allocations domain.AllocationRepository,
	transactions domain.TransactionRepository,
) AccountService {
	return &accountService{
		accounts:     accounts,
		budgets:      budgets,
		allocations:  allocations,
		transactions: transactions,
	}
}

func (s *accountService) Create(ctx context.Context, budgetID, name string, accType domain.AccountType, balance int64) (*domain.Account, error) {
	acc := &domain.Account{
		ID:        generateID(),
		BudgetID:  budgetID,
		Name:      name,
		Type:      accType,
		Balance:   balance,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := acc.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.accounts.Create(ctx, acc); err != nil {
		return nil, err
	}
	return acc, nil
}

func (s *accountService) List(ctx context.Context, budgetID string) ([]*domain.Account, error) {
	accounts, err := s.accounts.ListByBudget(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	b, err := s.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	if b.Method != domain.MethodEnvelope {
		return accounts, nil
	}

	for _, acc := range accounts {
		unallocated, err := s.calculateUnallocated(ctx, budgetID, acc)
		if err == nil {
			acc.Balance = unallocated
		}
	}
	return accounts, nil
}

func (s *accountService) GetByID(ctx context.Context, id string) (*domain.Account, error) {
	acc, err := s.accounts.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: account not found", ErrNotFound)
	}

	b, err := s.budgets.GetByID(ctx, acc.BudgetID)
	if err == nil && b.Method == domain.MethodEnvelope {
		unallocated, err := s.calculateUnallocated(ctx, acc.BudgetID, acc)
		if err == nil {
			acc.Balance = unallocated
		}
	}
	return acc, nil
}

func (s *accountService) calculateUnallocated(ctx context.Context, budgetID string, acc *domain.Account) (int64, error) {
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

func (s *accountService) Update(ctx context.Context, acc *domain.Account) (*domain.Account, error) {
	acc.UpdatedAt = time.Now()
	if err := acc.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.accounts.Update(ctx, acc); err != nil {
		return nil, err
	}
	return acc, nil
}

func (s *accountService) Delete(ctx context.Context, id string) error {
	_, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.accounts.Delete(ctx, id)
}
