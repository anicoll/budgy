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

// Budget represents a budgeting project owned by a user.
type Budget struct {
	ID        string       `json:"id"`
	UserID    string       `json:"user_id"`
	Name      string       `json:"name"`
	Method    BudgetMethod `json:"method"`
	Currency  string       `json:"currency"` // e.g. "USD", "EUR"
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
	ID             string      `json:"id"`
	BudgetID       string      `json:"budget_id"`
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
	if a.BudgetID == "" {
		return errors.New("budget ID is required")
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

// Category represents a budget category (or "envelope") where funds are allocated.
type Category struct {
	ID          string    `json:"id"`
	BudgetID    string    `json:"budget_id"`
	Name        string    `json:"name"`
	Budgeted    int64     `json:"budgeted"`     // Allocated amount (e.g. monthly budgeted) in cents
	Balance     int64     `json:"balance"`      // Virtual balance (e.g. envelope contents) in cents
	TargetLimit int64     `json:"target_limit"` // Optional Target capacity (specifically for Envelope budgeting)
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Validate validates the Category fields.
func (c *Category) Validate() error {
	if c.BudgetID == "" {
		return errors.New("budget ID is required")
	}
	if c.Name == "" {
		return errors.New("category name cannot be empty")
	}
	if c.Budgeted < 0 {
		return errors.New("budgeted amount cannot be negative")
	}
	if c.TargetLimit < 0 {
		return errors.New("target limit cannot be negative")
	}
	return nil
}

// Transaction represents a financial flow (inflow or outflow) affecting accounts and categories.
type Transaction struct {
	ID              string     `json:"id"`
	BudgetID        string     `json:"budget_id"`
	AccountID       string     `json:"account_id"`
	CategoryID      string     `json:"category_id"` // Can be empty for unassigned inflows or transfers
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
	if t.BudgetID == "" {
		return errors.New("budget ID is required")
	}
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
