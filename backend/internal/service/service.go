package service

//go:generate go run github.com/vektra/mockery/v3@v3.7.1 --config ../../.mockery.yml

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"budgeting_system/internal/domain"

	"golang.org/x/crypto/bcrypt"
)

// Define custom errors
var (
	ErrNotFound      = errors.New("resource not found")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrForbidden     = errors.New("forbidden")
	ErrConflict      = errors.New("conflict")
	ErrBadRequest    = errors.New("bad request")
)

// AuthService coordinates user registration, authentication, and management.
type AuthService interface {
	Register(ctx context.Context, email, password, firstName, lastName string) (*domain.User, error)
	Login(ctx context.Context, email, password string) (*domain.User, error)
	GetUserByID(ctx context.Context, userID string) (*domain.User, error)
	GetUserByBasiqUserID(ctx context.Context, basiqUserID string) (*domain.User, error)
}

// BudgetService coordinates budget CRUD and summary operations.
type BudgetService interface {
	Create(ctx context.Context, userID, name string, method domain.BudgetMethod, currency string) (*domain.Budget, error)
	GetByID(ctx context.Context, id string) (*domain.Budget, error)
	List(ctx context.Context, userID string) ([]*domain.Budget, error)
	Update(ctx context.Context, id string, name string, method domain.BudgetMethod, currency string) (*domain.Budget, error)
	Delete(ctx context.Context, id string) error
	GetSummary(ctx context.Context, id string) (interface{}, error)
}

// AccountService coordinates account operations.
type AccountService interface {
	Create(ctx context.Context, budgetID, name string, accType domain.AccountType, balance int64) (*domain.Account, error)
	List(ctx context.Context, budgetID string) ([]*domain.Account, error)
	GetByID(ctx context.Context, id string) (*domain.Account, error)
	Update(ctx context.Context, acc *domain.Account) (*domain.Account, error)
	Delete(ctx context.Context, id string) error
}

// CategoryService coordinates categories and envelope funding.
type CategoryService interface {
	Create(ctx context.Context, budgetID, name string, targetLimit int64) (*domain.Category, error)
	List(ctx context.Context, budgetID string) ([]*domain.Category, error)
	GetByID(ctx context.Context, id string) (*domain.Category, error)
	Update(ctx context.Context, cat *domain.Category) (*domain.Category, error)
	Delete(ctx context.Context, id string) error
	AssignFunds(ctx context.Context, budgetID, catID string, amount int64) (*domain.Category, error)
	FundEnvelope(ctx context.Context, budgetID, catID, accountID string, amount int64) (*domain.Account, *domain.Category, error)
}

// TransactionService coordinates transactions.
type TransactionService interface {
	Create(ctx context.Context, budgetID, accountID, categoryID string, amount int64, description string, date time.Time) (*domain.Transaction, error)
	List(ctx context.Context, budgetID string) ([]*domain.Transaction, error)
	Update(ctx context.Context, budgetID, txID string, updates *domain.Transaction) (*domain.Transaction, error)
	Delete(ctx context.Context, budgetID, txID string) error
}

// BankSyncService coordinates bank syncing integrations.
type BankSyncService interface {
	GetAuthLink(ctx context.Context, userID string) (string, string, error) // token, connectURL, err
	SyncUser(ctx context.Context, userID string) error
}

// Concrete Implementations

type authService struct {
	users domain.UserRepository
}

func NewAuthService(users domain.UserRepository) AuthService {
	return &authService{users: users}
}

func (s *authService) Register(ctx context.Context, email, password, firstName, lastName string) (*domain.User, error) {
	existing, err := s.users.GetByEmail(ctx, email)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("%w: user with this email already exists", ErrConflict)
	}

	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &domain.User{
		ID:           generateID(),
		Email:        email,
		PasswordHash: string(bytes),
		FirstName:    firstName,
		LastName:     lastName,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *authService) Login(ctx context.Context, email, password string) (*domain.User, error) {
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid credentials", ErrUnauthorized)
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("%w: invalid credentials", ErrUnauthorized)
	}

	return user, nil
}

func (s *authService) GetUserByID(ctx context.Context, userID string) (*domain.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("%w: user not found", ErrNotFound)
	}
	return user, nil
}

func (s *authService) GetUserByBasiqUserID(ctx context.Context, basiqUserID string) (*domain.User, error) {
	user, err := s.users.GetByBasiqUserID(ctx, basiqUserID)
	if err != nil {
		return nil, fmt.Errorf("%w: user not found", ErrNotFound)
	}
	return user, nil
}

type budgetService struct {
	budgets      domain.BudgetRepository
	accounts     domain.AccountRepository
	categories   domain.CategoryRepository
}

func NewBudgetService(budgets domain.BudgetRepository, accounts domain.AccountRepository, categories domain.CategoryRepository) BudgetService {
	return &budgetService{budgets: budgets, accounts: accounts, categories: categories}
}

func (s *budgetService) Create(ctx context.Context, userID, name string, method domain.BudgetMethod, currency string) (*domain.Budget, error) {
	b := &domain.Budget{
		ID:        generateID(),
		UserID:    userID,
		Name:      name,
		Method:    method,
		Currency:  currency,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := b.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.budgets.Create(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *budgetService) GetByID(ctx context.Context, id string) (*domain.Budget, error) {
	b, err := s.budgets.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: budget not found", ErrNotFound)
	}
	return b, nil
}

func (s *budgetService) List(ctx context.Context, userID string) ([]*domain.Budget, error) {
	return s.budgets.List(ctx, userID)
}

func (s *budgetService) Update(ctx context.Context, id string, name string, method domain.BudgetMethod, currency string) (*domain.Budget, error) {
	b, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if name != "" {
		b.Name = name
	}
	if method != "" {
		b.Method = method
	}
	if currency != "" {
		b.Currency = currency
	}
	b.UpdatedAt = time.Now()

	if err := b.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}

	if err := s.budgets.Update(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *budgetService) Delete(ctx context.Context, id string) error {
	_, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.budgets.Delete(ctx, id)
}

func (s *budgetService) GetSummary(ctx context.Context, id string) (interface{}, error) {
	b, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	accounts, err := s.accounts.ListByBudget(ctx, id)
	if err != nil {
		return nil, err
	}

	categories, err := s.categories.ListByBudget(ctx, id)
	if err != nil {
		return nil, err
	}

	if b.Method == domain.MethodZeroSum {
		return domain.CalculateZeroSumSummary(accounts, categories), nil
	}

	summaries := make([]domain.EnvelopeSummary, 0, len(categories))
	for _, cat := range categories {
		summaries = append(summaries, domain.GetEnvelopeSummary(cat))
	}
	return summaries, nil
}

type accountService struct {
	accounts domain.AccountRepository
}

func NewAccountService(accounts domain.AccountRepository) AccountService {
	return &accountService{accounts: accounts}
}

func (s *accountService) Create(ctx context.Context, budgetID, name string, accType domain.AccountType, balance int64) (*domain.Account, error) {
	acc := &domain.Account{
		ID:        generateID(),
		BudgetID:  budgetID,
		Name:      name,
		Type:      accType,
		Balance:   balance,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := acc.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.accounts.Create(ctx, acc); err != nil {
		return nil, err
	}
	return acc, nil
}

func (s *accountService) List(ctx context.Context, budgetID string) ([]*domain.Account, error) {
	return s.accounts.ListByBudget(ctx, budgetID)
}

func (s *accountService) GetByID(ctx context.Context, id string) (*domain.Account, error) {
	acc, err := s.accounts.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: account not found", ErrNotFound)
	}
	return acc, nil
}

func (s *accountService) Update(ctx context.Context, acc *domain.Account) (*domain.Account, error) {
	acc.UpdatedAt = time.Now()
	if err := acc.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.accounts.Update(ctx, acc); err != nil {
		return nil, err
	}
	return acc, nil
}

func (s *accountService) Delete(ctx context.Context, id string) error {
	_, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.accounts.Delete(ctx, id)
}

type categoryService struct {
	categories domain.CategoryRepository
	accounts   domain.AccountRepository
}

func NewCategoryService(categories domain.CategoryRepository, accounts domain.AccountRepository) CategoryService {
	return &categoryService{categories: categories, accounts: accounts}
}

func (s *categoryService) Create(ctx context.Context, budgetID, name string, targetLimit int64) (*domain.Category, error) {
	c := &domain.Category{
		ID:          generateID(),
		BudgetID:    budgetID,
		Name:        name,
		Budgeted:    0,
		Balance:     0,
		TargetLimit: targetLimit,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := c.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.categories.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *categoryService) List(ctx context.Context, budgetID string) ([]*domain.Category, error) {
	return s.categories.ListByBudget(ctx, budgetID)
}

func (s *categoryService) GetByID(ctx context.Context, id string) (*domain.Category, error) {
	c, err := s.categories.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: category not found", ErrNotFound)
	}
	return c, nil
}

func (s *categoryService) Update(ctx context.Context, cat *domain.Category) (*domain.Category, error) {
	cat.UpdatedAt = time.Now()
	if err := cat.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}
	if err := s.categories.Update(ctx, cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *categoryService) Delete(ctx context.Context, id string) error {
	_, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.categories.Delete(ctx, id)
}

func (s *categoryService) AssignFunds(ctx context.Context, budgetID, catID string, amount int64) (*domain.Category, error) {
	cat, err := s.GetByID(ctx, catID)
	if err != nil {
		return nil, err
	}
	if cat.BudgetID != budgetID {
		return nil, fmt.Errorf("%w: category does not belong to budget", ErrBadRequest)
	}

	accounts, err := s.accounts.ListByBudget(ctx, budgetID)
	if err != nil {
		return nil, err
	}
	categories, err := s.categories.ListByBudget(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	summary := domain.CalculateZeroSumSummary(accounts, categories)
	updatedCat, err := domain.AssignFunds(summary, cat, amount)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}

	err = s.categories.UpdateBudgetedAndBalance(ctx, catID, updatedCat.Budgeted, updatedCat.Balance)
	if err != nil {
		return nil, err
	}

	return updatedCat, nil
}

func (s *categoryService) FundEnvelope(ctx context.Context, budgetID, catID, accountID string, amount int64) (*domain.Account, *domain.Category, error) {
	acc, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: account not found", ErrNotFound)
	}
	if acc.BudgetID != budgetID {
		return nil, nil, fmt.Errorf("%w: account does not belong to budget", ErrBadRequest)
	}

	cat, err := s.GetByID(ctx, catID)
	if err != nil {
		return nil, nil, err
	}
	if cat.BudgetID != budgetID {
		return nil, nil, fmt.Errorf("%w: envelope does not belong to budget", ErrBadRequest)
	}

	updatedAcc, updatedEnv, err := domain.FundEnvelope(acc, cat, amount)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}

	err = s.accounts.UpdateBalance(ctx, acc.ID, updatedAcc.Balance)
	if err != nil {
		return nil, nil, err
	}

	err = s.categories.UpdateBudgetedAndBalance(ctx, cat.ID, updatedEnv.Budgeted, updatedEnv.Balance)
	if err != nil {
		return nil, nil, err
	}

	return updatedAcc, updatedEnv, nil
}

type transactionService struct {
	transactions domain.TransactionRepository
	accounts     domain.AccountRepository
	categories   domain.CategoryRepository
	budgets      domain.BudgetRepository
}

func NewTransactionService(
	transactions domain.TransactionRepository,
	accounts domain.AccountRepository,
	categories domain.CategoryRepository,
	budgets domain.BudgetRepository,
) TransactionService {
	return &transactionService{
		transactions: transactions,
		accounts:     accounts,
		categories:   categories,
		budgets:      budgets,
	}
}

func (s *transactionService) Create(ctx context.Context, budgetID, accountID, categoryID string, amount int64, description string, date time.Time) (*domain.Transaction, error) {
	b, err := s.budgets.GetByID(ctx, budgetID)
	if err != nil {
		return nil, fmt.Errorf("%w: budget not found", ErrNotFound)
	}

	acc, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("%w: account not found", ErrNotFound)
	}
	if acc.BudgetID != budgetID {
		return nil, fmt.Errorf("%w: account does not belong to budget", ErrBadRequest)
	}

	var cat *domain.Category
	if categoryID != "" {
		cat, err = s.categories.GetByID(ctx, categoryID)
		if err != nil {
			return nil, fmt.Errorf("%w: category not found", ErrNotFound)
		}
		if cat.BudgetID != budgetID {
			return nil, fmt.Errorf("%w: category does not belong to budget", ErrBadRequest)
		}
	}

	tx := &domain.Transaction{
		ID:          generateID(),
		BudgetID:    budgetID,
		AccountID:   accountID,
		CategoryID:  categoryID,
		Amount:      amount,
		Description: description,
		Date:        date,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := tx.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}

	var updatedAcc *domain.Account
	var updatedEnv *domain.Category

	if b.Method == domain.MethodZeroSum {
		updatedAcc = &domain.Account{
			ID:      acc.ID,
			Balance: acc.Balance + amount,
		}
		if cat != nil {
			updatedEnv = &domain.Category{
				ID:       cat.ID,
				Budgeted: cat.Budgeted,
				Balance:  cat.Balance + amount,
			}
		}
	} else {
		// Envelope method
		if cat != nil {
			updatedAcc, updatedEnv, err = domain.SpendFromEnvelope(acc, cat, -amount)
			if err != nil {
				if amount > 0 {
					updatedAcc = &domain.Account{ID: acc.ID, Balance: acc.Balance + amount}
					updatedEnv = &domain.Category{ID: cat.ID, Budgeted: cat.Budgeted, Balance: cat.Balance + amount}
				} else {
					return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
				}
			}
		} else {
			updatedAcc = &domain.Account{
				ID:      acc.ID,
				Balance: acc.Balance + amount,
			}
		}
	}

	if err := s.transactions.Create(ctx, tx); err != nil {
		return nil, err
	}

	if err := s.accounts.UpdateBalance(ctx, acc.ID, updatedAcc.Balance); err != nil {
		return nil, err
	}

	if updatedEnv != nil {
		err = s.categories.UpdateBudgetedAndBalance(ctx, cat.ID, updatedEnv.Budgeted, updatedEnv.Balance)
		if err != nil {
			return nil, err
		}
	}

	return tx, nil
}

func (s *transactionService) List(ctx context.Context, budgetID string) ([]*domain.Transaction, error) {
	return s.transactions.ListByBudget(ctx, budgetID)
}

func (s *transactionService) Update(ctx context.Context, budgetID, txID string, updates *domain.Transaction) (*domain.Transaction, error) {
	oldTx, err := s.transactions.GetByID(ctx, txID)
	if err != nil {
		return nil, fmt.Errorf("%w: transaction not found", ErrNotFound)
	}
	if oldTx.BudgetID != budgetID {
		return nil, fmt.Errorf("%w: transaction does not belong to budget", ErrBadRequest)
	}

	newAccountID := oldTx.AccountID
	if updates.AccountID != "" && updates.AccountID != oldTx.AccountID {
		newAccountID = updates.AccountID
		newAcc, err := s.accounts.GetByID(ctx, newAccountID)
		if err != nil {
			return nil, fmt.Errorf("%w: new account not found", ErrNotFound)
		}
		if newAcc.BudgetID != budgetID {
			return nil, fmt.Errorf("%w: new account does not belong to budget", ErrBadRequest)
		}
	}

	newCategoryID := oldTx.CategoryID
	if updates.CategoryID != oldTx.CategoryID {
		newCategoryID = updates.CategoryID
		if newCategoryID != "" {
			newCat, err := s.categories.GetByID(ctx, newCategoryID)
			if err != nil {
				return nil, fmt.Errorf("%w: new category not found", ErrNotFound)
			}
			if newCat.BudgetID != budgetID {
				return nil, fmt.Errorf("%w: new category does not belong to budget", ErrBadRequest)
			}
		}
	}

	newAmount := oldTx.Amount
	if updates.Amount != 0 {
		newAmount = updates.Amount
	}

	accountChanges := make(map[string]int64)
	categoryChanges := make(map[string]int64)

	accountChanges[oldTx.AccountID] -= oldTx.Amount
	if oldTx.CategoryID != "" {
		categoryChanges[oldTx.CategoryID] -= oldTx.Amount
	}

	accountChanges[newAccountID] += newAmount
	if newCategoryID != "" {
		categoryChanges[newCategoryID] += newAmount
	}

	tx := *oldTx
	tx.AccountID = newAccountID
	tx.CategoryID = newCategoryID
	tx.Amount = newAmount
	if updates.Description != "" {
		tx.Description = updates.Description
	}
	if !updates.Date.IsZero() {
		tx.Date = updates.Date
	}
	if updates.Direction != "" {
		tx.Direction = updates.Direction
	}
	if updates.Status != "" {
		tx.Status = updates.Status
	}
	if updates.Class != "" {
		tx.Class = updates.Class
	}
	if updates.PostDate != nil {
		tx.PostDate = updates.PostDate
	}
	if updates.SubClass != "" {
		tx.SubClass = updates.SubClass
	}
	if updates.RawDescription != "" {
		tx.RawDescription = updates.RawDescription
	}
	if updates.MerchantName != "" {
		tx.MerchantName = updates.MerchantName
	}
	tx.UpdatedAt = time.Now()

	if err := tx.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrBadRequest, err.Error())
	}

	if err := s.transactions.Update(ctx, &tx); err != nil {
		return nil, err
	}

	for accID, delta := range accountChanges {
		if delta != 0 {
			acc, err := s.accounts.GetByID(ctx, accID)
			if err != nil {
				return nil, err
			}
			acc.Balance += delta
			if err := s.accounts.UpdateBalance(ctx, acc.ID, acc.Balance); err != nil {
				return nil, err
			}
		}
	}

	for catID, delta := range categoryChanges {
		if delta != 0 {
			c, err := s.categories.GetByID(ctx, catID)
			if err != nil {
				return nil, err
			}
			c.Balance += delta
			if err := s.categories.UpdateBudgetedAndBalance(ctx, c.ID, c.Budgeted, c.Balance); err != nil {
				return nil, err
			}
		}
	}

	return &tx, nil
}

func (s *transactionService) Delete(ctx context.Context, budgetID, txID string) error {
	tx, err := s.transactions.GetByID(ctx, txID)
	if err != nil {
		return fmt.Errorf("%w: transaction not found", ErrNotFound)
	}
	if tx.BudgetID != budgetID {
		return fmt.Errorf("%w: transaction does not belong to budget", ErrBadRequest)
	}

	accountChanges := make(map[string]int64)
	categoryChanges := make(map[string]int64)

	accountChanges[tx.AccountID] -= tx.Amount
	if tx.CategoryID != "" {
		categoryChanges[tx.CategoryID] -= tx.Amount
	}

	if err := s.transactions.Delete(ctx, txID); err != nil {
		return err
	}

	for accID, delta := range accountChanges {
		if delta != 0 {
			acc, err := s.accounts.GetByID(ctx, accID)
			if err != nil {
				return err
			}
			acc.Balance += delta
			if err := s.accounts.UpdateBalance(ctx, acc.ID, acc.Balance); err != nil {
				return err
			}
		}
	}

	for catID, delta := range categoryChanges {
		if delta != 0 {
			c, err := s.categories.GetByID(ctx, catID)
			if err != nil {
				return err
			}
			c.Balance += delta
			if err := s.categories.UpdateBudgetedAndBalance(ctx, c.ID, c.Budgeted, c.Balance); err != nil {
				return err
			}
		}
	}

	return nil
}

type bankSyncService struct {
	users        domain.UserRepository
	budgets      domain.BudgetRepository
	accounts     domain.AccountRepository
	transactions domain.TransactionRepository
	provider     domain.BankSyncProvider
}

func NewBankSyncService(
	users domain.UserRepository,
	budgets domain.BudgetRepository,
	accounts domain.AccountRepository,
	transactions domain.TransactionRepository,
	provider domain.BankSyncProvider,
) BankSyncService {
	return &bankSyncService{
		users:        users,
		budgets:      budgets,
		accounts:     accounts,
		transactions: transactions,
		provider:     provider,
	}
}

func (s *bankSyncService) GetAuthLink(ctx context.Context, userID string) (string, string, error) {
	if s.provider == nil {
		return "", "", fmt.Errorf("bank sync service is not configured")
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return "", "", fmt.Errorf("%w: user not found", ErrNotFound)
	}

	basiqUserID := user.BasiqUserID
	if basiqUserID == "" {
		id, err := s.provider.CreateBasiqUser(ctx, user.Email, user.FirstName, user.LastName)
		if err != nil {
			return "", "", fmt.Errorf("failed to create Basiq user: %w", err)
		}
		basiqUserID = id
		if err := s.users.UpdateBasiqUserID(ctx, user.ID, basiqUserID); err != nil {
			return "", "", fmt.Errorf("failed to save Basiq User ID: %w", err)
		}
	}

	token, err := s.provider.GetClientToken(ctx, basiqUserID)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate client token: %w", err)
	}

	connectURL := fmt.Sprintf("https://consent.basiq.io/home?token=%s", token)
	return token, connectURL, nil
}

func (s *bankSyncService) SyncUser(ctx context.Context, userID string) error {
	if s.provider == nil {
		return fmt.Errorf("bank sync service is not configured")
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("%w: user not found", ErrNotFound)
	}

	basiqUserID := user.BasiqUserID
	if basiqUserID == "" {
		return fmt.Errorf("%w: no connected Basiq account found", ErrBadRequest)
	}

	budgetsList, err := s.budgets.List(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to list budgets: %w", err)
	}

	var budgetID string
	if len(budgetsList) == 0 {
		defaultBudget := &domain.Budget{
			ID:        generateID(),
			UserID:    userID,
			Name:      "Default Budget",
			Method:    domain.MethodZeroSum,
			Currency:  "AUD",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		if err := s.budgets.Create(ctx, defaultBudget); err != nil {
			return fmt.Errorf("failed to create default budget: %w", err)
		}
		budgetID = defaultBudget.ID
	} else {
		budgetID = budgetsList[0].ID
	}

	accounts, transactions, err := s.provider.FetchAccountsAndTransactions(ctx, basiqUserID)
	if err != nil {
		return fmt.Errorf("failed to fetch bank data: %w", err)
	}

	for _, acc := range accounts {
		acc.BudgetID = budgetID
		existing, err := s.accounts.GetByID(ctx, acc.ID)
		if err != nil {
			if err := s.accounts.Create(ctx, acc); err != nil {
				return fmt.Errorf("failed to create account %s: %w", acc.ID, err)
			}
		} else {
			existing.Name = acc.Name
			existing.Balance = acc.Balance
			existing.AvailableFunds = acc.AvailableFunds
			existing.Class = acc.Class
			existing.AccountNo = acc.AccountNo
			existing.Product = acc.Product
			existing.InstitutionID = acc.InstitutionID
			existing.ConnectionID = acc.ConnectionID
			existing.LastUpdated = acc.LastUpdated
			existing.UpdatedAt = time.Now()
			if err := s.accounts.Update(ctx, existing); err != nil {
				return fmt.Errorf("failed to update account %s: %w", acc.ID, err)
			}
		}
	}

	for _, tx := range transactions {
		tx.BudgetID = budgetID
		_, err := s.transactions.GetByID(ctx, tx.ID)
		if err != nil {
			if err := s.transactions.Create(ctx, tx); err != nil {
				return fmt.Errorf("failed to create transaction %s: %w", tx.ID, err)
			}
		} else {
			tx.UpdatedAt = time.Now()
			if err := s.transactions.Update(ctx, tx); err != nil {
				return fmt.Errorf("failed to update transaction %s: %w", tx.ID, err)
			}
		}
	}

	return nil
}

// Helper utilities

func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
