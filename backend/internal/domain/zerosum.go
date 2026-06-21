package domain

import (
	"errors"
)

// ZeroSumSummary contains the calculated state of a Zero-Sum budget.
type ZeroSumSummary struct {
	TotalAvailableFunds int64 `json:"total_available_funds"` // Sum of checking, savings, cash - credit cards
	TotalAssignedFunds  int64 `json:"total_assigned_funds"`  // Sum of category budgeted amounts
	ReadyToAssign       int64 `json:"ready_to_assign"`       // TotalAvailableFunds - TotalAssignedFunds
}

// CalculateZeroSumSummary computes the summary for a list of accounts and budget category lines.
func CalculateZeroSumSummary(accounts []*Account, categories []*BudgetCategory) ZeroSumSummary {
	var totalAvailable int64
	for _, acc := range accounts {
		totalAvailable += acc.Balance
	}

	var totalAssigned int64
	for _, cat := range categories {
		totalAssigned += cat.Budgeted
	}

	return ZeroSumSummary{
		TotalAvailableFunds: totalAvailable,
		TotalAssignedFunds:  totalAssigned,
		ReadyToAssign:       totalAvailable - totalAssigned,
	}
}

// AssignFunds assigns money from the ReadyToAssign pool to a specific category line.
func AssignFunds(summary ZeroSumSummary, category *BudgetCategory, amount int64) (*BudgetCategory, error) {
	if amount < 0 {
		return nil, errors.New("cannot assign a negative amount of funds")
	}

	updated := *category
	updated.Budgeted += amount

	return &updated, nil
}
