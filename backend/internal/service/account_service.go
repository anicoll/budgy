package service

import (
	"context"
	"fmt"
	"time"

	"budgeting_system/internal/domain"
)

type accountService struct {
	accounts    domain.AccountRepository
	budgets     domain.BudgetRepository
	budgetAccts domain.BudgetAccountRepository
	allocations domain.AllocationRepository
	transactions domain.TransactionRepository
}

func NewAccountService(
	accounts domain.AccountRepository,
	budgets domain.BudgetRepository,
	budgetAccts domain.BudgetAccountRepository,
	allocations domain.AllocationRepository,
	transactions domain.TransactionRepository,
) AccountService {
	return &accountService{
		accounts:     accounts,
		budgets:      budgets,
		budgetAccts:  budgetAccts,
		allocations:  allocations,
		transactions: transactions,
	}
}

func (s *accountService) Create(ctx context.Context, userID, name string, accType domain.AccountType, balance int64) (*domain.Account, error) {
	acc := &domain.Account{
		ID:        generateID(),
		UserID:    userID,
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

func (s *accountService) List(ctx context.Context, userID string) ([]*domain.Account, error) {
	return s.accounts.ListByUser(ctx, userID)
}

func (s *accountService) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Account, error) {
	b, err := s.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return nil, fmt.Errorf("%w: budget not found", ErrNotFound)
	}

	accounts, err := s.budgetAccts.ListAccountsByBudget(ctx, budgetID)
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
	return acc, nil
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
	if _, err := s.GetByID(ctx, id); err != nil {
		return err
	}
	return s.accounts.Delete(ctx, id)
}

func (s *accountService) LinkToBudget(ctx context.Context, budgetID, accountID, userID string) error {
	b, err := s.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return fmt.Errorf("%w: budget not found", ErrNotFound)
	}
	if err := verifyBudgetOwner(b, userID); err != nil {
		return err
	}
	acc, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return fmt.Errorf("%w: account not found", ErrNotFound)
	}
	if err := verifyAccountOwner(acc, userID); err != nil {
		return err
	}
	return s.budgetAccts.Link(ctx, budgetID, accountID)
}

func (s *accountService) UnlinkFromBudget(ctx context.Context, budgetID, accountID, userID string) error {
	b, err := s.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return fmt.Errorf("%w: budget not found", ErrNotFound)
	}
	if err := verifyBudgetOwner(b, userID); err != nil {
		return err
	}
	acc, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return fmt.Errorf("%w: account not found", ErrNotFound)
	}
	if err := verifyAccountOwner(acc, userID); err != nil {
		return err
	}
	return s.budgetAccts.Unlink(ctx, budgetID, accountID)
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
