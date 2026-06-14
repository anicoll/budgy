package domain

import (
	"testing"
)

func TestGetEnvelopeSummary(t *testing.T) {
	tests := []struct {
		name     string
		category *Category
		expected EnvelopeSummary
	}{
		{
			name: "Normal state under capacity",
			category: &Category{
				ID:          "1",
				Name:        "Groceries",
				Balance:     20000, // $200.00
				TargetLimit: 50000, // $500.00 target
			},
			expected: EnvelopeSummary{
				CategoryID:        "1",
				Name:              "Groceries",
				Balance:           20000,
				TargetLimit:       50000,
				IsOverdrawn:       false,
				UnderfundedAmount: 30000, // $300.00 underfunded
			},
		},
		{
			name: "Fully funded envelope",
			category: &Category{
				ID:          "2",
				Name:        "Rent",
				Balance:     150000,
				TargetLimit: 150000,
			},
			expected: EnvelopeSummary{
				CategoryID:        "2",
				Name:              "Rent",
				Balance:           150000,
				TargetLimit:       150000,
				IsOverdrawn:       false,
				UnderfundedAmount: 0,
			},
		},
		{
			name: "Overdrawn envelope",
			category: &Category{
				ID:          "3",
				Name:        "Dining Out",
				Balance:     -5000, // Overspent by $50.00
				TargetLimit: 10000,
			},
			expected: EnvelopeSummary{
				CategoryID:        "3",
				Name:              "Dining Out",
				Balance:           -5000,
				TargetLimit:       10000,
				IsOverdrawn:       true,
				UnderfundedAmount: 15000, // Needs 15000 to reach target
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GetEnvelopeSummary(tt.category)
			if got.CategoryID != tt.expected.CategoryID {
				t.Errorf("expected ID %s, got %s", tt.expected.CategoryID, got.CategoryID)
			}
			if got.Balance != tt.expected.Balance {
				t.Errorf("expected Balance %d, got %d", tt.expected.Balance, got.Balance)
			}
			if got.IsOverdrawn != tt.expected.IsOverdrawn {
				t.Errorf("expected IsOverdrawn %t, got %t", tt.expected.IsOverdrawn, got.IsOverdrawn)
			}
			if got.UnderfundedAmount != tt.expected.UnderfundedAmount {
				t.Errorf("expected UnderfundedAmount %d, got %d", tt.expected.UnderfundedAmount, got.UnderfundedAmount)
			}
		})
	}
}

func TestFundEnvelope(t *testing.T) {
	acc := &Account{
		ID:      "acc-1",
		Balance: 100000, // $1000.00
	}
	env := &Category{
		ID:      "env-1",
		Balance: 5000, // $50.00
	}

	updatedAcc, updatedEnv, err := FundEnvelope(acc, env, 30000) // move $300.00
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if updatedAcc.Balance != 70000 {
		t.Errorf("expected account balance 70000, got %d", updatedAcc.Balance)
	}
	if updatedEnv.Balance != 35000 {
		t.Errorf("expected envelope balance 35000, got %d", updatedEnv.Balance)
	}

	// Insufficient funds test
	_, _, err = FundEnvelope(acc, env, 200000)
	if err == nil {
		t.Error("expected error for funding greater than account balance, got nil")
	}
}

func TestSpendFromEnvelope(t *testing.T) {
	acc := &Account{
		ID:      "acc-1",
		Balance: 100000,
	}
	env := &Category{
		ID:      "env-1",
		Balance: 10000, // $100.00 inside
	}

	updatedAcc, updatedEnv, err := SpendFromEnvelope(acc, env, 15000) // Spend $150.00
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if updatedAcc.Balance != 85000 {
		t.Errorf("expected account balance 85000, got %d", updatedAcc.Balance)
	}
	// Envelopes can go negative (overdrawn)
	if updatedEnv.Balance != -5000 {
		t.Errorf("expected envelope balance -5000, got %d", updatedEnv.Balance)
	}
}
