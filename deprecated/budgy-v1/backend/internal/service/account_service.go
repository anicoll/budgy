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
	reconciler  domain.BudgetReconciler
}

func NewAccountService(
	accounts domain.AccountRepository,
	budgets domain.BudgetRepository,
	budgetAccts domain.BudgetAccountRepository,
	reconciler domain.BudgetReconciler,
) AccountService {
	return &accountService{
		accounts:    accounts,
		budgets:     budgets,
		budgetAccts: budgetAccts,
		reconciler:  reconciler,
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
	if _, err := s.budgets.GetByID(ctx, budgetID); err != nil {
		return nil, fmt.Errorf("%w: budget not found", ErrNotFound)
	}
	return s.budgetAccts.ListAccountsByBudget(ctx, budgetID)
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

	existingBudget, err := s.budgetAccts.FindBudgetForAccount(ctx, accountID)
	if err != nil {
		return err
	}
	if existingBudget != "" && existingBudget != budgetID {
		return fmt.Errorf("%w: account is already linked to another budget", ErrConflict)
	}

	if err := s.budgetAccts.Link(ctx, budgetID, accountID); err != nil {
		return err
	}
	if s.reconciler != nil {
		return s.reconciler.ReconcileFromTransactions(ctx, budgetID)
	}
	return nil
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
	if err := s.budgetAccts.Unlink(ctx, budgetID, accountID); err != nil {
		return err
	}
	if s.reconciler != nil {
		return s.reconciler.ReconcileFromTransactions(ctx, budgetID)
	}
	return nil
}
