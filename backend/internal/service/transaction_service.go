package service

import (
	"context"
	"fmt"
	"time"

	"budgeting_system/internal/domain"
)

type transactionService struct {
	transactions domain.TransactionRepository
	accounts     domain.AccountRepository
	categories   domain.CategoryRepository
	budgets      domain.BudgetRepository
}

func NewTransactionService(
	transactions domain.TransactionRepository,
	accounts domain.AccountRepository,
	categories domain.CategoryRepository,
	budgets domain.BudgetRepository,
) TransactionService {
	return &transactionService{
		transactions: transactions,
		accounts:     accounts,
		categories:   categories,
		budgets:      budgets,
	}
}

func (s *transactionService) Create(ctx context.Context, budgetID, accountID, categoryID string, amount int64, description string, date time.Time) (*domain.Transaction, error) {
	b, err := s.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return nil, fmt.Errorf("%w: budget not found", ErrNotFound)
	}

	acc, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("%w: account not found", ErrNotFound)
	}
	if acc.BudgetID != budgetID {
		return nil, fmt.Errorf("%w: account does not belong to budget", ErrBadRequest)
	}

	var cat *domain.Category
	if categoryID != "" {
		cat, err = s.categories.GetByID(ctx, categoryID)
		if err != nil {
			return nil, fmt.Errorf("%w: category not found", ErrNotFound)
		}
		if cat.BudgetID != budgetID {
			return nil, fmt.Errorf("%w: category does not belong to budget", ErrBadRequest)
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
	var updatedEnv *domain.Category

	if b.Method == domain.MethodZeroSum {
		updatedAcc = &domain.Account{
			ID:      acc.ID,
			Balance: acc.Balance + amount,
		}
		if cat != nil {
			updatedEnv = &domain.Category{
				ID:       cat.ID,
				Budgeted: cat.Budgeted,
				Balance:  cat.Balance + amount,
			}
		}
	} else {
		// Envelope method
		if cat != nil {
			updatedAcc, updatedEnv, err = domain.SpendFromEnvelope(acc, cat, -amount)
			if err != nil {
				if amount > 0 {
					updatedAcc = &domain.Account{ID: acc.ID, Balance: acc.Balance + amount}
					updatedEnv = &domain.Category{ID: cat.ID, Budgeted: cat.Budgeted, Balance: cat.Balance + amount}
				} else {
					return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
				}
			}
		} else {
			updatedAcc = &domain.Account{
				ID:      acc.ID,
				Balance: acc.Balance + amount,
			}
		}
	}

	if err := s.transactions.Create(ctx, tx); err != nil {
		return nil, err
	}

	if err := s.accounts.UpdateBalance(ctx, acc.ID, updatedAcc.Balance); err != nil {
		return nil, err
	}

	if updatedEnv != nil {
		err = s.categories.UpdateBudgetedAndBalance(ctx, cat.ID, updatedEnv.Budgeted, updatedEnv.Balance)
		if err != nil {
			return nil, err
		}
	}

	return tx, nil
}

func (s *transactionService) List(ctx context.Context, budgetID string) ([]*domain.Transaction, error) {
	return s.transactions.ListByBudget(ctx, budgetID)
}

func (s *transactionService) Update(ctx context.Context, budgetID, txID string, updates *domain.Transaction) (*domain.Transaction, error) {
	oldTx, err := s.transactions.GetByID(ctx, txID)
	if err != nil {
		return nil, fmt.Errorf("%w: transaction not found", ErrNotFound)
	}
	if oldTx.BudgetID != budgetID {
		return nil, fmt.Errorf("%w: transaction does not belong to budget", ErrBadRequest)
	}

	newAccountID := oldTx.AccountID
	if updates.AccountID != "" && updates.AccountID != oldTx.AccountID {
		newAccountID = updates.AccountID
		newAcc, err := s.accounts.GetByID(ctx, newAccountID)
		if err != nil {
			return nil, fmt.Errorf("%w: new account not found", ErrNotFound)
		}
		if newAcc.BudgetID != budgetID {
			return nil, fmt.Errorf("%w: new account does not belong to budget", ErrBadRequest)
		}
	}

	newCategoryID := oldTx.CategoryID
	if updates.CategoryID != oldTx.CategoryID {
		newCategoryID = updates.CategoryID
		if newCategoryID != "" {
			newCat, err := s.categories.GetByID(ctx, newCategoryID)
			if err != nil {
				return nil, fmt.Errorf("%w: new category not found", ErrNotFound)
			}
			if newCat.BudgetID != budgetID {
				return nil, fmt.Errorf("%w: new category does not belong to budget", ErrBadRequest)
			}
		}
	}

	newAmount := oldTx.Amount
	if updates.Amount != 0 {
		newAmount = updates.Amount
	}

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

	tx := *oldTx
	tx.AccountID = newAccountID
	tx.CategoryID = newCategoryID
	tx.Amount = newAmount
	if updates.Description != "" {
		tx.Description = updates.Description
	}
	if !updates.Date.IsZero() {
		tx.Date = updates.Date
	}
	if updates.Direction != "" {
		tx.Direction = updates.Direction
	}
	if updates.Status != "" {
		tx.Status = updates.Status
	}
	if updates.Class != "" {
		tx.Class = updates.Class
	}
	if updates.PostDate != nil {
		tx.PostDate = updates.PostDate
	}
	if updates.SubClass != "" {
		tx.SubClass = updates.SubClass
	}
	if updates.RawDescription != "" {
		tx.RawDescription = updates.RawDescription
	}
	if updates.MerchantName != "" {
		tx.MerchantName = updates.MerchantName
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
			acc.Balance += delta
			if err := s.accounts.UpdateBalance(ctx, acc.ID, acc.Balance); err != nil {
				return nil, err
			}
		}
	}

	for catID, delta := range categoryChanges {
		if delta != 0 {
			c, err := s.categories.GetByID(ctx, catID)
			if err != nil {
				return nil, err
			}
			c.Balance += delta
			if err := s.categories.UpdateBudgetedAndBalance(ctx, c.ID, c.Budgeted, c.Balance); err != nil {
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
	if tx.BudgetID != budgetID {
		return fmt.Errorf("%w: transaction does not belong to budget", ErrBadRequest)
	}

	accountChanges := make(map[string]int64)
	categoryChanges := make(map[string]int64)

	accountChanges[tx.AccountID] -= tx.Amount
	if tx.CategoryID != "" {
		categoryChanges[tx.CategoryID] -= tx.Amount
	}

	if err := s.transactions.Delete(ctx, txID); err != nil {
		return err
	}

	for accID, delta := range accountChanges {
		if delta != 0 {
			acc, err := s.accounts.GetByID(ctx, accID)
			if err != nil {
				return err
			}
			acc.Balance += delta
			if err := s.accounts.UpdateBalance(ctx, acc.ID, acc.Balance); err != nil {
				return err
			}
		}
	}

	for catID, delta := range categoryChanges {
		if delta != 0 {
			c, err := s.categories.GetByID(ctx, catID)
			if err != nil {
				return err
			}
			c.Balance += delta
			if err := s.categories.UpdateBudgetedAndBalance(ctx, c.ID, c.Budgeted, c.Balance); err != nil {
				return err
			}
		}
	}

	return nil
}
