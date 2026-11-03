package domain

import "context"

// BudgetReconciler recalculates category line balances from linked-account transactions.
type BudgetReconciler interface {
	ReconcileFromTransactions(ctx context.Context, budgetID string) error
}

// ComputeCategoryBalance returns budgeted plus the sum of transaction amounts for a category.
func ComputeCategoryBalance(budgeted int64, txSum int64) int64 {
	return budgeted + txSum
}
