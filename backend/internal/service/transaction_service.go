package service

import (
	"context"
	"fmt"
	"slices"
	"time"

	"budgeting_system/internal/domain"
)

type transactionService struct {
	transactions domain.TransactionRepository
	accounts     domain.AccountRepository
	categories   domain.CategoryRepository
	budgets      domain.BudgetRepository
	budgetAccts  domain.BudgetAccountRepository
	budgetLines  domain.BudgetCategoryLineRepository
	reconciler   domain.BudgetReconciler
}

func NewTransactionService(
	transactions domain.TransactionRepository,
	accounts domain.AccountRepository,
	categories domain.CategoryRepository,
	budgets domain.BudgetRepository,
	budgetAccts domain.BudgetAccountRepository,
	budgetLines domain.BudgetCategoryLineRepository,
	reconciler domain.BudgetReconciler,
) TransactionService {
	return &transactionService{
		transactions: transactions,
		accounts:     accounts,
		categories:   categories,
		budgets:      budgets,
		budgetAccts:  budgetAccts,
		budgetLines:  budgetLines,
		reconciler:   reconciler,
	}
}

func (s *transactionService) verifyAccountInBudget(ctx context.Context, budgetID, accountID string) (*domain.Account, error) {
	acc, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("%w: account not found", ErrNotFound)
	}
	ids, err := s.budgetAccts.ListByBudget(ctx, budgetID)
	if err != nil {
		return nil, err
	}
	if !slices.Contains(ids, accountID) {
		return nil, fmt.Errorf("%w: account is not linked to budget", ErrBadRequest)
	}
	return acc, nil
}

func (s *transactionService) Create(ctx context.Context, budgetID, accountID, categoryID string, amount int64, description string, date time.Time) (*domain.Transaction, error) {
	b, err := s.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return nil, fmt.Errorf("%w: budget not found", ErrNotFound)
	}

	acc, err := s.verifyAccountInBudget(ctx, budgetID, accountID)
	if err != nil {
		return nil, err
	}

	if categoryID != "" {
		cat, err := s.categories.GetByID(ctx, categoryID)
		if err != nil {
			return nil, fmt.Errorf("%w: category not found", ErrNotFound)
		}
		if cat.UserID != b.UserID {
			return nil, fmt.Errorf("%w: category does not belong to user", ErrBadRequest)
		}
		if err := s.budgetLines.EnsureLine(ctx, budgetID, categoryID); err != nil {
			return nil, err
		}
	}

	tx := &domain.Transaction{
		ID:          generateID(),
		BudgetID:    budgetID,
		AccountID:   accountID,
		CategoryID:  categoryID,
		Amount:      amount,
		Description: description,
		Date:        date,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := tx.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}

	if err := s.transactions.Create(ctx, tx); err != nil {
		return nil, err
	}
	if err := s.accounts.UpdateBalance(ctx, acc.ID, acc.Balance+amount); err != nil {
		return nil, err
	}
	if s.reconciler != nil {
		if err := s.reconciler.ReconcileFromTransactions(ctx, budgetID); err != nil {
			return nil, err
		}
	}
	return tx, nil
}

func (s *transactionService) List(ctx context.Context, budgetID string) ([]*domain.Transaction, error) {
	return s.transactions.ListByBudget(ctx, budgetID)
}

func (s *transactionService) ListByUser(ctx context.Context, userID string) ([]*domain.Transaction, error) {
	return s.transactions.ListByUser(ctx, userID)
}

func (s *transactionService) Update(ctx context.Context, budgetID, txID string, updates *domain.Transaction) (*domain.Transaction, error) {
	oldTx, err := s.transactions.GetByID(ctx, txID)
	if err != nil {
		return nil, fmt.Errorf("%w: transaction not found", ErrNotFound)
	}
	if _, err := s.verifyAccountInBudget(ctx, budgetID, oldTx.AccountID); err != nil {
		return nil, err
	}

	newAccountID := oldTx.AccountID
	if updates.AccountID != "" && updates.AccountID != oldTx.AccountID {
		if _, err := s.verifyAccountInBudget(ctx, budgetID, updates.AccountID); err != nil {
			return nil, err
		}
		newAccountID = updates.AccountID
	}

	newCategoryID := oldTx.CategoryID
	if updates.CategoryID != oldTx.CategoryID {
		newCategoryID = updates.CategoryID
		if newCategoryID != "" {
			b, err := s.budgets.GetByID(ctx, budgetID)
			if err != nil {
				return nil, err
			}
			cat, err := s.categories.GetByID(ctx, newCategoryID)
			if err != nil {
				return nil, fmt.Errorf("%w: new category not found", ErrNotFound)
			}
			if cat.UserID != b.UserID {
				return nil, fmt.Errorf("%w: new category does not belong to user", ErrBadRequest)
			}
			if err := s.budgetLines.EnsureLine(ctx, budgetID, newCategoryID); err != nil {
				return nil, err
			}
		}
	}

	newAmount := oldTx.Amount
	if updates.Amount != 0 {
		newAmount = updates.Amount
	}

	accountChanges := map[string]int64{oldTx.AccountID: -oldTx.Amount}
	accountChanges[newAccountID] += newAmount

	tx := *oldTx
	tx.BudgetID = budgetID
	tx.AccountID = newAccountID
	tx.CategoryID = newCategoryID
	tx.Amount = newAmount
	if updates.Description != "" {
		tx.Description = updates.Description
	}
	if !updates.Date.IsZero() {
		tx.Date = updates.Date
	}
	tx.UpdatedAt = time.Now()

	if err := tx.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.transactions.Update(ctx, &tx); err != nil {
		return nil, err
	}

	for accID, delta := range accountChanges {
		if delta != 0 {
			acc, err := s.accounts.GetByID(ctx, accID)
			if err != nil {
				return nil, err
			}
			if err := s.accounts.UpdateBalance(ctx, acc.ID, acc.Balance+delta); err != nil {
				return nil, err
			}
		}
	}
	if s.reconciler != nil {
		if err := s.reconciler.ReconcileFromTransactions(ctx, budgetID); err != nil {
			return nil, err
		}
	}
	return &tx, nil
}

func (s *transactionService) Delete(ctx context.Context, budgetID, txID string) error {
	tx, err := s.transactions.GetByID(ctx, txID)
	if err != nil {
		return fmt.Errorf("%w: transaction not found", ErrNotFound)
	}
	if _, err := s.verifyAccountInBudget(ctx, budgetID, tx.AccountID); err != nil {
		return err
	}

	if err := s.transactions.Delete(ctx, txID); err != nil {
		return err
	}

	acc, err := s.accounts.GetByID(ctx, tx.AccountID)
	if err != nil {
		return err
	}
	if err := s.accounts.UpdateBalance(ctx, acc.ID, acc.Balance-tx.Amount); err != nil {
		return err
	}
	if s.reconciler != nil {
		return s.reconciler.ReconcileFromTransactions(ctx, budgetID)
	}
	return nil
}
