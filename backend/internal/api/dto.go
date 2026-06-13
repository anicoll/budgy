package api

import (
	"time"

	"budgeting_system/internal/domain"
)

// Auth DTOs

type RegisterRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UserResponse struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	BasiqUserID string    `json:"basiq_user_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func ToUserResponse(u *domain.User) UserResponse {
	return UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		FirstName:   u.FirstName,
		LastName:    u.LastName,
		BasiqUserID: u.BasiqUserID,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

// Budget DTOs

type CreateBudgetRequest struct {
	Name     string              `json:"name"`
	Method   domain.BudgetMethod `json:"method"`
	Currency string              `json:"currency"`
}

type UpdateBudgetRequest struct {
	Name     string              `json:"name"`
	Method   domain.BudgetMethod `json:"method"`
	Currency string              `json:"currency"`
}

type BudgetResponse struct {
	ID        string              `json:"id"`
	UserID    string              `json:"user_id"`
	Name      string              `json:"name"`
	Method    domain.BudgetMethod `json:"method"`
	Currency  string              `json:"currency"`
	CreatedAt time.Time           `json:"created_at"`
	UpdatedAt time.Time           `json:"updated_at"`
}

func ToBudgetResponse(b *domain.Budget) BudgetResponse {
	return BudgetResponse{
		ID:        b.ID,
		UserID:    b.UserID,
		Name:      b.Name,
		Method:    b.Method,
		Currency:  b.Currency,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}

func ToBudgetListResponse(list []*domain.Budget) []BudgetResponse {
	res := make([]BudgetResponse, len(list))
	for i, b := range list {
		res[i] = ToBudgetResponse(b)
	}
	return res
}

// Account DTOs

type CreateAccountRequest struct {
	Name    string             `json:"name"`
	Type    domain.AccountType `json:"type"`
	Balance int64              `json:"balance"`
}

type UpdateAccountRequest struct {
	Name           *string             `json:"name,omitempty"`
	Type           *domain.AccountType `json:"type,omitempty"`
	Balance        *int64              `json:"balance,omitempty"`
	Class          *string             `json:"class,omitempty"`
	AccountNo      *string             `json:"account_no,omitempty"`
	AvailableFunds *int64              `json:"available_funds,omitempty"`
	Product        *string             `json:"product,omitempty"`
	InstitutionID  *string             `json:"institution_id,omitempty"`
	ConnectionID   *string             `json:"connection_id,omitempty"`
	LastUpdated    *time.Time          `json:"last_updated,omitempty"`
}

type AccountResponse struct {
	ID             string             `json:"id"`
	BudgetID       string             `json:"budget_id"`
	Name           string             `json:"name"`
	Type           domain.AccountType `json:"type"`
	Balance        int64              `json:"balance"`
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
	Class          string             `json:"class,omitempty"`
	AccountNo      string             `json:"account_no,omitempty"`
	AvailableFunds *int64             `json:"available_funds,omitempty"`
	Product        string             `json:"product,omitempty"`
	InstitutionID  string             `json:"institution_id,omitempty"`
	ConnectionID   string             `json:"connection_id,omitempty"`
	LastUpdated    *time.Time         `json:"last_updated,omitempty"`
}

func ToAccountResponse(a *domain.Account) AccountResponse {
	return AccountResponse{
		ID:             a.ID,
		BudgetID:       a.BudgetID,
		Name:           a.Name,
		Type:           a.Type,
		Balance:        a.Balance,
		CreatedAt:      a.CreatedAt,
		UpdatedAt:      a.UpdatedAt,
		Class:          a.Class,
		AccountNo:      a.AccountNo,
		AvailableFunds: a.AvailableFunds,
		Product:        a.Product,
		InstitutionID:  a.InstitutionID,
		ConnectionID:   a.ConnectionID,
		LastUpdated:    a.LastUpdated,
	}
}

func ToAccountListResponse(list []*domain.Account) []AccountResponse {
	res := make([]AccountResponse, len(list))
	for i, a := range list {
		res[i] = ToAccountResponse(a)
	}
	return res
}

// Category / Envelope DTOs

type CreateCategoryRequest struct {
	Name        string `json:"name"`
	TargetLimit int64  `json:"target_limit"`
}

type UpdateCategoryRequest struct {
	Name        *string `json:"name,omitempty"`
	Budgeted    *int64  `json:"budgeted,omitempty"`
	Balance     *int64  `json:"balance,omitempty"`
	TargetLimit *int64  `json:"target_limit,omitempty"`
}

type AssignCategoryFundsRequest struct {
	Amount int64 `json:"amount"`
}

type FundEnvelopeRequest struct {
	AccountID string `json:"account_id"`
	Amount    int64  `json:"amount"`
}

type CategoryResponse struct {
	ID          string    `json:"id"`
	BudgetID    string    `json:"budget_id"`
	Name        string    `json:"name"`
	Budgeted    int64     `json:"budgeted"`
	Balance     int64     `json:"balance"`
	TargetLimit int64     `json:"target_limit"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func ToCategoryResponse(c *domain.Category) CategoryResponse {
	return CategoryResponse{
		ID:          c.ID,
		BudgetID:    c.BudgetID,
		Name:        c.Name,
		Budgeted:    c.Budgeted,
		Balance:     c.Balance,
		TargetLimit: c.TargetLimit,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

func ToCategoryListResponse(list []*domain.Category) []CategoryResponse {
	res := make([]CategoryResponse, len(list))
	for i, c := range list {
		res[i] = ToCategoryResponse(c)
	}
	return res
}

// Transaction DTOs

type CreateTransactionRequest struct {
	AccountID   string `json:"account_id"`
	CategoryID  string `json:"category_id,omitempty"` // optional
	Amount      int64  `json:"amount"`
	Description string `json:"description"`
	Date        string `json:"date"`
}

type UpdateTransactionRequest struct {
	AccountID      *string    `json:"account_id,omitempty"`
	CategoryID     *string    `json:"category_id,omitempty"`
	Amount         *int64     `json:"amount,omitempty"`
	Description    *string    `json:"description,omitempty"`
	Date           *string    `json:"date,omitempty"`
	Direction      *string    `json:"direction,omitempty"`
	Status         *string    `json:"status,omitempty"`
	Class          *string    `json:"class,omitempty"`
	PostDate       *time.Time `json:"post_date,omitempty"`
	SubClass       *string    `json:"sub_class,omitempty"`
	RawDescription *string    `json:"raw_description,omitempty"`
	MerchantName   *string    `json:"merchant_name,omitempty"`
}

type TransactionResponse struct {
	ID             string     `json:"id"`
	BudgetID       string     `json:"budget_id"`
	AccountID      string     `json:"account_id"`
	CategoryID     string     `json:"category_id,omitempty"`
	Amount         int64      `json:"amount"`
	Description    string     `json:"description"`
	Date           time.Time  `json:"date"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	Direction      string     `json:"direction,omitempty"`
	Status         string     `json:"status,omitempty"`
	Class          string     `json:"class,omitempty"`
	PostDate       *time.Time `json:"post_date,omitempty"`
	SubClass       string     `json:"sub_class,omitempty"`
	RawDescription string     `json:"raw_description,omitempty"`
	MerchantName   string     `json:"merchant_name,omitempty"`
}

func ToTransactionResponse(t *domain.Transaction) TransactionResponse {
	return TransactionResponse{
		ID:             t.ID,
		BudgetID:       t.BudgetID,
		AccountID:      t.AccountID,
		CategoryID:     t.CategoryID,
		Amount:         t.Amount,
		Description:    t.Description,
		Date:           t.Date,
		CreatedAt:      t.CreatedAt,
		UpdatedAt:      t.UpdatedAt,
		Direction:      t.Direction,
		Status:         t.Status,
		Class:          t.Class,
		PostDate:       t.PostDate,
		SubClass:       t.SubClass,
		RawDescription: t.RawDescription,
		MerchantName:   t.MerchantName,
	}
}

func ToTransactionListResponse(list []*domain.Transaction) []TransactionResponse {
	res := make([]TransactionResponse, len(list))
	for i, t := range list {
		res[i] = ToTransactionResponse(t)
	}
	return res
}

// Basiq DTOs

type BasiqAuthLinkResponse struct {
	Token      string `json:"token"`
	ConnectURL string `json:"connect_url"`
}
