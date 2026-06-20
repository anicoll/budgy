package domain

import (
	"testing"
)

func TestCalculateZeroSumSummary(t *testing.T) {
	accounts := []*Account{
		{ID: "1", Name: "Checking", Type: AccountChecking, Balance: 100000},
		{ID: "2", Name: "Savings", Type: AccountSavings, Balance: 500000},
		{ID: "3", Name: "Credit Card", Type: AccountCreditCard, Balance: -50000},
	}

	categories := []*BudgetCategory{
		{Category: Category{ID: "1", Name: "Rent"}, Budgeted: 150000, Balance: 150000},
		{Category: Category{ID: "2", Name: "Groceries"}, Budgeted: 30000, Balance: 30000},
	}

	summary := CalculateZeroSumSummary(accounts, categories)

	if summary.TotalAvailableFunds != 550000 {
		t.Errorf("expected available funds 550000, got %d", summary.TotalAvailableFunds)
	}
	if summary.TotalAssignedFunds != 180000 {
		t.Errorf("expected assigned funds 180000, got %d", summary.TotalAssignedFunds)
	}
	if summary.ReadyToAssign != 370000 {
		t.Errorf("expected ReadyToAssign 370000, got %d", summary.ReadyToAssign)
	}
}

func TestAssignFunds(t *testing.T) {
	summary := ZeroSumSummary{
		TotalAvailableFunds: 500000,
		TotalAssignedFunds:  200000,
		ReadyToAssign:       300000,
	}

	cat := &BudgetCategory{
		Category: Category{ID: "1", Name: "Entertainment"},
		Budgeted: 5000,
		Balance:  5000,
	}

	updated, err := AssignFunds(summary, cat, 10000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Budgeted != 15000 {
		t.Errorf("expected budgeted amount 15000, got %d", updated.Budgeted)
	}
	if updated.Balance != 15000 {
		t.Errorf("expected balance 15000, got %d", updated.Balance)
	}

	_, err = AssignFunds(summary, cat, -100)
	if err == nil {
		t.Error("expected error when assigning negative funds, got nil")
	}
}
