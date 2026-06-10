package domain

import (
	"errors"
)

// EnvelopeSummary contains calculated metrics for a specific Envelope (stored as Category).
type EnvelopeSummary struct {
	CategoryID        string `json:"category_id"`
	Name              string `json:"name"`
	Balance           int64  `json:"balance"`
	TargetLimit       int64  `json:"target_limit"`
	IsOverdrawn       bool   `json:"is_overdrawn"`       // Balance < 0
	UnderfundedAmount int64  `json:"underfunded_amount"` // TargetLimit - Balance (if Balance < TargetLimit)
}

// GetEnvelopeSummary computes the summary metrics for an envelope (represented as a Category).
func GetEnvelopeSummary(c *Category) EnvelopeSummary {
	underfunded := int64(0)
	if c.TargetLimit > 0 && c.Balance < c.TargetLimit {
		underfunded = c.TargetLimit - c.Balance
	}

	return EnvelopeSummary{
		CategoryID:        c.ID,
		Name:              c.Name,
		Balance:           c.Balance,
		TargetLimit:       c.TargetLimit,
		IsOverdrawn:       c.Balance < 0,
		UnderfundedAmount: underfunded,
	}
}

// FundEnvelope deposits a specified amount of money from an Account into an Envelope (Category).
// It returns the updated Account and Category, or an error if the account has insufficient funds.
func FundEnvelope(acc *Account, env *Category, amount int64) (*Account, *Category, error) {
	if amount <= 0 {
		return nil, nil, errors.New("funding amount must be greater than zero")
	}
	if acc.Balance < amount {
		return nil, nil, errors.New("insufficient funds in the account to fund the envelope")
	}

	updatedAcc := *acc
	updatedAcc.Balance -= amount

	updatedEnv := *env
	updatedEnv.Balance += amount

	return &updatedAcc, &updatedEnv, nil
}

// SpendFromEnvelope records a transaction against an envelope, reducing both the account and envelope balances.
// If the envelope balance goes negative, it succeeds but indicates an overdrawn warning.
func SpendFromEnvelope(acc *Account, env *Category, amount int64) (*Account, *Category, error) {
	if amount <= 0 {
		return nil, nil, errors.New("spending amount must be greater than zero")
	}

	updatedAcc := *acc
	updatedAcc.Balance -= amount

	updatedEnv := *env
	updatedEnv.Balance -= amount

	return &updatedAcc, &updatedEnv, nil
}
