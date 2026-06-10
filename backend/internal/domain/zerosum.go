package domain

import (
	"errors"
)

// ZeroSumSummary contains the calculated state of a Zero-Sum budget.
type ZeroSumSummary struct {
	TotalAvailableFunds int64 `json:"total_available_funds"` // Sum of checking, savings, cash - credit cards
	TotalAssignedFunds  int64 `json:"total_assigned_funds"`  // Sum of all category balances
	ReadyToAssign       int64 `json:"ready_to_assign"`       // TotalAvailableFunds - TotalAssignedFunds
}

// CalculateZeroSumSummary computes the summary for a list of accounts and categories.
func CalculateZeroSumSummary(accounts []*Account, categories []*Category) ZeroSumSummary {
	var totalAvailable int64
	for _, acc := range accounts {
		// Assets (checking, savings, cash) are positive; liabilities (credit card debt) reduce available funds.
		// If the account balance is negative (like a credit card bill), it reduces total available.
		// Here, we just sum up the balances. If a credit card has a negative balance (debt), it naturally reduces the sum.
		totalAvailable += acc.Balance
	}

	var totalAssigned int64
	for _, cat := range categories {
		totalAssigned += cat.Balance
	}

	return ZeroSumSummary{
		TotalAvailableFunds: totalAvailable,
		TotalAssignedFunds:  totalAssigned,
		ReadyToAssign:       totalAvailable - totalAssigned,
	}
}

// AssignFunds assigns money from the ReadyToAssign pool to a specific category.
// It returns the updated Category or an error if there is insufficient money, or if the action is invalid.
func AssignFunds(summary ZeroSumSummary, category *Category, amount int64) (*Category, error) {
	if amount < 0 {
		return nil, errors.New("cannot assign a negative amount of funds")
	}
	if summary.ReadyToAssign < amount {
		// In Zero-Sum, we can assign more than we have, but it results in a negative ReadyToAssign warning state.
		// For the domain logic, we allow it but return the updated state.
	}

	updated := *category
	updated.Budgeted += amount
	updated.Balance += amount

	return &updated, nil
}
