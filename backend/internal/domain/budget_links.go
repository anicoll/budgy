package domain

import "time"

// BudgetAccount links an account into a budget grouping.
type BudgetAccount struct {
	BudgetID  string `json:"budget_id"`
	AccountID string `json:"account_id"`
}

// BudgetCategoryLine tracks envelope/zero-sum state for a category within a budget.
type BudgetCategoryLine struct {
	BudgetID    string    `json:"budget_id"`
	CategoryID  string    `json:"category_id"`
	Budgeted    int64     `json:"budgeted"`
	Balance     int64     `json:"balance"`
	TargetLimit int64     `json:"target_limit"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BudgetCategory combines taxonomy with per-budget line state for API responses.
type BudgetCategory struct {
	Category
	Budgeted    int64 `json:"budgeted"`
	Balance     int64 `json:"balance"`
	TargetLimit int64 `json:"target_limit"`
}
