package service

import (
	"context"
	"fmt"
	"time"

	"budgeting_system/internal/domain"
)

type categoryService struct {
	categories   domain.CategoryRepository
	accounts     domain.AccountRepository
	allocations  domain.AllocationRepository
	transactions domain.TransactionRepository
}

func NewCategoryService(
	categories domain.CategoryRepository,
	accounts domain.AccountRepository,
	allocations domain.AllocationRepository,
	transactions domain.TransactionRepository,
) CategoryService {
	return &categoryService{
		categories:   categories,
		accounts:     accounts,
		allocations:  allocations,
		transactions: transactions,
	}
}

func (s *categoryService) Create(ctx context.Context, budgetID, name string, targetLimit int64) (*domain.Category, error) {
	c := &domain.Category{
		ID:          generateID(),
		BudgetID:    budgetID,
		Name:        name,
		Budgeted:    0,
		Balance:     0,
		TargetLimit: targetLimit,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := c.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.categories.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *categoryService) List(ctx context.Context, budgetID string) ([]*domain.Category, error) {
	return s.categories.ListByBudget(ctx, budgetID)
}

func (s *categoryService) GetByID(ctx context.Context, id string) (*domain.Category, error) {
	c, err := s.categories.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: category not found", ErrNotFound)
	}
	return c, nil
}

func (s *categoryService) Update(ctx context.Context, cat *domain.Category) (*domain.Category, error) {
	cat.UpdatedAt = time.Now()
	if err := cat.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.categories.Update(ctx, cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *categoryService) Delete(ctx context.Context, id string) error {
	_, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.categories.Delete(ctx, id)
}

func (s *categoryService) AssignFunds(ctx context.Context, budgetID, catID string, amount int64) (*domain.Category, error) {
	cat, err := s.GetByID(ctx, catID)
	if err != nil {
		return nil, err
	}
	if cat.BudgetID != budgetID {
		return nil, fmt.Errorf("%w: category does not belong to budget", ErrBadRequest)
	}

	accounts, err := s.accounts.ListByBudget(ctx, budgetID)
	if err != nil {
		return nil, err
	}
	categories, err := s.categories.ListByBudget(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	summary := domain.CalculateZeroSumSummary(accounts, categories)
	updatedCat, err := domain.AssignFunds(summary, cat, amount)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}

	err = s.categories.UpdateBudgetedAndBalance(ctx, catID, updatedCat.Budgeted, updatedCat.Balance)
	if err != nil {
		return nil, err
	}

	return updatedCat, nil
}

func (s *categoryService) calculateUnallocated(ctx context.Context, budgetID string, acc *domain.Account) (int64, error) {
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

func (s *categoryService) FundEnvelope(ctx context.Context, budgetID, catID, accountID string, amount int64) (*domain.Account, *domain.Category, error) {
	acc, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: account not found", ErrNotFound)
	}
	if acc.BudgetID != budgetID {
		return nil, nil, fmt.Errorf("%w: account does not belong to budget", ErrBadRequest)
	}

	cat, err := s.GetByID(ctx, catID)
	if err != nil {
		return nil, nil, err
	}
	if cat.BudgetID != budgetID {
		return nil, nil, fmt.Errorf("%w: envelope does not belong to budget", ErrBadRequest)
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
	updatedEnv.UpdatedAt = time.Now()

	err = s.categories.UpdateBudgetedAndBalance(ctx, cat.ID, updatedEnv.Budgeted, updatedEnv.Balance)
	if err != nil {
		return nil, nil, err
	}

	updatedAcc := *acc
	updatedAcc.Balance = unallocated - amount

	return &updatedAcc, &updatedEnv, nil
}
