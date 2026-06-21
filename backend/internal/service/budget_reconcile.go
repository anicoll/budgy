package service

import (
	"context"

	"budgeting_system/internal/domain"
)

func (s *budgetService) ReconcileFromTransactions(ctx context.Context, budgetID string) error {
	if _, err := s.GetByID(ctx, budgetID); err != nil {
		return err
	}

	accountIDs, err := s.budgetAccts.ListByBudget(ctx, budgetID)
	if err != nil {
		return err
	}

	catTotals := make(map[string]int64)
	for _, accID := range accountIDs {
		txs, err := s.transactions.ListByAccount(ctx, accID)
		if err != nil {
			return err
		}
		for _, tx := range txs {
			if catID := tx.EffectiveCategoryID(); catID != "" {
				catTotals[catID] += tx.Amount
			}
		}
	}

	for catID, txSum := range catTotals {
		if err := s.budgetLines.EnsureLine(ctx, budgetID, catID); err != nil {
			return err
		}
		line, err := s.budgetLines.Get(ctx, budgetID, catID)
		if err != nil {
			return err
		}
		balance := domain.ComputeCategoryBalance(line.Budgeted, txSum)
		if err := s.budgetLines.UpdateBudgetedAndBalance(ctx, budgetID, catID, line.Budgeted, balance); err != nil {
			return err
		}
	}

	lines, err := s.budgetLines.ListByBudget(ctx, budgetID)
	if err != nil {
		return err
	}
	for _, line := range lines {
		if _, hasTx := catTotals[line.CategoryID]; hasTx {
			continue
		}
		balance := domain.ComputeCategoryBalance(line.Budgeted, 0)
		if err := s.budgetLines.UpdateBudgetedAndBalance(ctx, budgetID, line.CategoryID, line.Budgeted, balance); err != nil {
			return err
		}
	}

	return nil
}

func (s *budgetService) ReconcileForAccount(ctx context.Context, accountID string) error {
	budgetID, err := s.budgetAccts.FindBudgetForAccount(ctx, accountID)
	if err != nil {
		return err
	}
	if budgetID == "" {
		return nil
	}
	return s.ReconcileFromTransactions(ctx, budgetID)
}

func (s *budgetService) ReconcileAllForUser(ctx context.Context, userID string) error {
	budgets, err := s.budgets.List(ctx, userID)
	if err != nil {
		return err
	}
	for _, b := range budgets {
		if err := s.ReconcileFromTransactions(ctx, b.ID); err != nil {
			return err
		}
	}
	return nil
}
