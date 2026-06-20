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
}

func NewTransactionService(
	transactions domain.TransactionRepository,
	accounts domain.AccountRepository,
	categories domain.CategoryRepository,
	budgets domain.BudgetRepository,
	budgetAccts domain.BudgetAccountRepository,
	budgetLines domain.BudgetCategoryLineRepository,
) TransactionService {
	return &transactionService{
		transactions: transactions,
		accounts:     accounts,
		categories:   categories,
		budgets:      budgets,
		budgetAccts:  budgetAccts,
		budgetLines:  budgetLines,
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
	linked := slices.Contains(ids, accountID)
	if !linked {
		return nil, fmt.Errorf("%w: account is not linked to budget", ErrBadRequest)
	}
	return acc, nil
}

func (s *transactionService) getBudgetCategory(ctx context.Context, budgetID, categoryID string) (*domain.BudgetCategory, error) {
	categories, err := s.budgetLines.ListBudgetCategories(ctx, budgetID)
	if err != nil {
		return nil, err
	}
	for _, c := range categories {
		if c.ID == categoryID {
			return c, nil
		}
	}
	return nil, fmt.Errorf("%w: category not found", ErrNotFound)
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

	var budgetCat *domain.BudgetCategory
	if categoryID != "" {
		cat, err := s.categories.GetByID(ctx, categoryID)
		if err != nil {
			return nil, fmt.Errorf("%w: category not found", ErrNotFound)
		}
		if cat.UserID != b.UserID {
			return nil, fmt.Errorf("%w: category does not belong to user", ErrBadRequest)
		}
		budgetCat, err = s.getBudgetCategory(ctx, budgetID, categoryID)
		if err != nil {
			if err := s.budgetLines.EnsureLine(ctx, budgetID, categoryID); err != nil {
				return nil, err
			}
			budgetCat = &domain.BudgetCategory{Category: *cat}
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

	var updatedAcc *domain.Account
	var updatedLine *domain.BudgetCategory

	if b.Method == domain.MethodZeroSum {
		updatedAcc = &domain.Account{ID: acc.ID, Balance: acc.Balance + amount}
		if budgetCat != nil {
			updatedLine = &domain.BudgetCategory{
				Category: budgetCat.Category,
				Budgeted: budgetCat.Budgeted,
				Balance:  budgetCat.Balance + amount,
			}
		}
	} else if budgetCat != nil {
		updatedAcc, updatedLine, err = domain.SpendFromEnvelope(acc, budgetCat, -amount)
		if err != nil {
			if amount > 0 {
				updatedAcc = &domain.Account{ID: acc.ID, Balance: acc.Balance + amount}
				updatedLine = &domain.BudgetCategory{
					Category: budgetCat.Category,
					Budgeted: budgetCat.Budgeted,
					Balance:  budgetCat.Balance + amount,
				}
			} else {
				return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
			}
		}
	} else {
		updatedAcc = &domain.Account{ID: acc.ID, Balance: acc.Balance + amount}
	}

	if err := s.transactions.Create(ctx, tx); err != nil {
		return nil, err
	}
	if err := s.accounts.UpdateBalance(ctx, acc.ID, updatedAcc.Balance); err != nil {
		return nil, err
	}
	if updatedLine != nil && categoryID != "" {
		if err := s.budgetLines.EnsureLine(ctx, budgetID, categoryID); err != nil {
			return nil, err
		}
		if err := s.budgetLines.UpdateBudgetedAndBalance(ctx, budgetID, categoryID, updatedLine.Budgeted, updatedLine.Balance); err != nil {
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
		}
	}

	newAmount := oldTx.Amount
	if updates.Amount != 0 {
		newAmount = updates.Amount
	}

	accountChanges := map[string]int64{oldTx.AccountID: -oldTx.Amount}
	categoryChanges := map[string]int64{}
	if oldTx.CategoryID != "" {
		categoryChanges[oldTx.CategoryID] = -oldTx.Amount
	}
	accountChanges[newAccountID] += newAmount
	if newCategoryID != "" {
		categoryChanges[newCategoryID] += newAmount
	}

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
	for catID, delta := range categoryChanges {
		if delta != 0 {
			line, err := s.budgetLines.Get(ctx, budgetID, catID)
			if err != nil {
				if err := s.budgetLines.EnsureLine(ctx, budgetID, catID); err != nil {
					return nil, err
				}
				line = &domain.BudgetCategoryLine{BudgetID: budgetID, CategoryID: catID}
			}
			if err := s.budgetLines.UpdateBudgetedAndBalance(ctx, budgetID, catID, line.Budgeted, line.Balance+delta); err != nil {
				return nil, err
			}
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
	if tx.CategoryID != "" {
		line, err := s.budgetLines.Get(ctx, budgetID, tx.CategoryID)
		if err == nil {
			_ = s.budgetLines.UpdateBudgetedAndBalance(ctx, budgetID, tx.CategoryID, line.Budgeted, line.Balance-tx.Amount)
		}
	}
	return nil
}
