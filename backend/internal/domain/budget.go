package domain

import (
	"errors"
	"time"
)

// BudgetMethod defines the type of budgeting method chosen for a budget.
type BudgetMethod string

const (
	MethodZeroSum  BudgetMethod = "ZERO_SUM"
	MethodEnvelope BudgetMethod = "ENVELOPE"
)

// BudgetPeriod is the default budgeting cycle for a budget.
type BudgetPeriod string

const (
	PeriodWeekly      BudgetPeriod = "weekly"
	PeriodFortnightly BudgetPeriod = "fortnightly"
	PeriodMonthly     BudgetPeriod = "monthly"
)

// BudgetFrequency is the native cadence for a category target amount.
type BudgetFrequency string

const (
	FrequencyWeekly      BudgetFrequency = "weekly"
	FrequencyFortnightly BudgetFrequency = "fortnightly"
	FrequencyMonthly     BudgetFrequency = "monthly"
	FrequencyQuarterly   BudgetFrequency = "quarterly"
	FrequencyYearly      BudgetFrequency = "yearly"
)

// Budget represents a budgeting project owned by a user.
type Budget struct {
	ID        string       `json:"id"`
	UserID    string       `json:"user_id"`
	Name      string       `json:"name"`
	Method    BudgetMethod `json:"method"`
	Currency  string       `json:"currency"`
	Period    BudgetPeriod `json:"period"`
	StartDate string       `json:"start_date"` // ISO date YYYY-MM-DD
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

// Validate validates the Budget fields.
func (b *Budget) Validate() error {
	if b.UserID == "" {
		return errors.New("user ID is required")
	}
	if b.Name == "" {
		return errors.New("budget name cannot be empty")
	}
	if b.Method != MethodZeroSum && b.Method != MethodEnvelope {
		return errors.New("invalid budget method; must be ZERO_SUM or ENVELOPE")
	}
	if b.Currency == "" {
		return errors.New("currency cannot be empty")
	}
	if b.Period != "" && b.Period != PeriodWeekly && b.Period != PeriodFortnightly && b.Period != PeriodMonthly {
		return errors.New("invalid budget period")
	}
	return nil
}

// AccountType defines the type of bank or asset account.
type AccountType string

const (
	AccountChecking   AccountType = "CHECKING"
	AccountSavings    AccountType = "SAVINGS"
	AccountCreditCard AccountType = "CREDIT_CARD"
	AccountCash       AccountType = "CASH"
)

// Account represents a physical or digital account holding money.
type Account struct {
	UserID         string      `json:"user_id"`
	ID             string      `json:"id"`
	Name           string      `json:"name"`
	Type           AccountType `json:"type"`
	Balance        int64       `json:"balance"` // Stored in minor units (e.g. cents) to avoid float issues
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
	Class          string      `json:"class,omitempty"`
	AccountNo      string      `json:"account_no,omitempty"`
	AvailableFunds *int64      `json:"available_funds,omitempty"`
	Product        string      `json:"product,omitempty"`
	InstitutionID  string      `json:"institution_id,omitempty"`
	ConnectionID   string      `json:"connection_id,omitempty"`
	LastUpdated    *time.Time  `json:"last_updated,omitempty"`
}

// Validate validates the Account fields.
func (a *Account) Validate() error {
	if a.UserID == "" {
		return errors.New("user ID is required")
	}
	if a.Name == "" {
		return errors.New("account name cannot be empty")
	}
	switch a.Type {
	case AccountChecking, AccountSavings, AccountCreditCard, AccountCash:
		// Valid type
	default:
		return errors.New("invalid account type")
	}
	return nil
}

// CategoryType classifies categories for reporting.
type CategoryType string

const (
	CategoryIncome   CategoryType = "income"
	CategoryExpense  CategoryType = "expense"
	CategoryTransfer CategoryType = "transfer"
)

// Category represents a user-owned nested taxonomy for labelling transactions.
type Category struct {
	ID                string       `json:"id"`
	UserID            string       `json:"user_id"`
	ParentID          string       `json:"parent_id,omitempty"`
	Name              string       `json:"name"`
	Type              CategoryType `json:"type"`
	Color             string       `json:"color"`
	Icon              string       `json:"icon,omitempty"`
	SortOrder         int          `json:"sort_order"`
	Archived          bool         `json:"archived"`
	System            bool         `json:"system"`
	BasiqSubClassCode string       `json:"basiq_subclass_code,omitempty"`
	AnzsicClassCode   string       `json:"anzsic_class_code,omitempty"`
	CreatedAt         time.Time    `json:"created_at"`
	UpdatedAt         time.Time    `json:"updated_at"`
}

// Validate validates the Category fields.
func (c *Category) Validate() error {
	if c.UserID == "" {
		return errors.New("user ID is required")
	}
	if c.Name == "" {
		return errors.New("category name cannot be empty")
	}
	switch c.Type {
	case CategoryIncome, CategoryExpense, CategoryTransfer:
	default:
		return errors.New("invalid category type")
	}
	return nil
}

// Transaction represents a financial flow (inflow or outflow) affecting accounts and categories.
type Transaction struct {
	ID              string     `json:"id"`
	BudgetID        string     `json:"budget_id"`
	AccountID       string     `json:"account_id"`
	CategoryID         string     `json:"category_id"`          // Basiq/sync-mapped category
	CustomerCategoryID string     `json:"customer_category_id"` // User override; takes precedence when set
	Amount          int64      `json:"amount"`      // positive = inflow (income), negative = outflow (expense)
	Description     string     `json:"description"`
	Date            time.Time  `json:"date"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	Direction       string     `json:"direction,omitempty"`
	Status          string     `json:"status,omitempty"`
	Class           string     `json:"class,omitempty"`
	PostDate        *time.Time `json:"post_date,omitempty"`
	SubClass        string     `json:"sub_class,omitempty"`
	RawDescription  string     `json:"raw_description,omitempty"`
	MerchantName    string     `json:"merchant_name,omitempty"`
	MerchantWebsite string     `json:"merchant_website,omitempty"`
	MerchantLogoURL string     `json:"merchant_logo_url,omitempty"`
	LocationAddress string     `json:"location_address,omitempty"`
	LocationLat     string     `json:"location_lat,omitempty"`
	LocationLng     string     `json:"location_lng,omitempty"`
	CategoryCode    string     `json:"category_code,omitempty"`
	CategoryTitle   string     `json:"category_title,omitempty"`
}

// Validate validates the Transaction fields.
func (t *Transaction) Validate() error {
	if t.AccountID == "" {
		return errors.New("account ID is required")
	}
	if t.Amount == 0 {
		return errors.New("transaction amount cannot be zero")
	}
	if t.Date.IsZero() {
		return errors.New("transaction date is required")
	}
	return nil
}

// EffectiveCategoryID returns the category used for budgeting and reports.
func (t *Transaction) EffectiveCategoryID() string {
	if t.CustomerCategoryID != "" {
		return t.CustomerCategoryID
	}
	return t.CategoryID
}

// EnvelopeAllocation tracks virtual allocations of physical account balances to specific categories/envelopes.
type EnvelopeAllocation struct {
	BudgetID   string    `json:"budget_id"`
	AccountID  string    `json:"account_id"`
	CategoryID string    `json:"category_id"`
	Amount     int64     `json:"amount"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Validate validates the EnvelopeAllocation fields.
func (ea *EnvelopeAllocation) Validate() error {
	if ea.BudgetID == "" {
		return errors.New("budget ID is required")
	}
	if ea.AccountID == "" {
		return errors.New("account ID is required")
	}
	if ea.CategoryID == "" {
		return errors.New("category ID is required")
	}
	if ea.Amount < 0 {
		return errors.New("allocated amount cannot be negative")
	}
	return nil
}
