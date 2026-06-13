package storage

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"budgeting_system/internal/domain"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestDB(t *testing.T) *sql.DB {
	// Open in-memory SQLite database
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)

	// Run migrations
	err = Migrate(db)
	require.NoError(t, err)

	return db
}

func TestBudgetRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	repo := store.Budgets()

	// Setup User first due to foreign key
	u := &domain.User{
		ID:        "user-1",
		Email:     "user1@example.com",
		FirstName: "User",
		LastName:  "One",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	err := store.Users().Create(ctx, u)
	assert.NoError(t, err)

	// Test Create
	b := &domain.Budget{
		ID:        "b-1",
		UserID:    "user-1",
		Name:      "Test Budget",
		Method:    domain.MethodZeroSum,
		Currency:  "USD",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	err = repo.Create(ctx, b)
	assert.NoError(t, err)

	// Test GetByID
	fetched, err := repo.GetByID(ctx, "b-1")
	assert.NoError(t, err)
	assert.Equal(t, b.ID, fetched.ID)
	assert.Equal(t, b.UserID, fetched.UserID)
	assert.Equal(t, b.Name, fetched.Name)
	assert.Equal(t, b.Method, fetched.Method)
	assert.Equal(t, b.Currency, fetched.Currency)

	// Test GetByID Not Found
	_, err = repo.GetByID(ctx, "unknown")
	assert.Error(t, err)

	// Test List
	list, err := repo.List(ctx, "user-1")
	assert.NoError(t, err)
	assert.Len(t, list, 1)
	assert.Equal(t, "b-1", list[0].ID)
}

func TestAccountRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	budgetRepo := store.Budgets()
	accountRepo := store.Accounts()

	// Setup Budget first due to foreign keys
	b := &domain.Budget{
		ID:        "b-1",
		Name:      "Test Budget",
		Method:    domain.MethodZeroSum,
		Currency:  "USD",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	err := budgetRepo.Create(ctx, b)
	require.NoError(t, err)

	acc := &domain.Account{
		ID:        "acc-1",
		BudgetID:  "b-1",
		Name:      "Checking",
		Type:      domain.AccountChecking,
		Balance:   150000,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Test Create
	err = accountRepo.Create(ctx, acc)
	assert.NoError(t, err)

	// Test GetByID
	fetched, err := accountRepo.GetByID(ctx, "acc-1")
	assert.NoError(t, err)
	assert.Equal(t, acc.ID, fetched.ID)
	assert.Equal(t, acc.Balance, fetched.Balance)

	// Test Update Balance
	err = accountRepo.UpdateBalance(ctx, "acc-1", 200000)
	assert.NoError(t, err)

	fetchedUpdated, err := accountRepo.GetByID(ctx, "acc-1")
	assert.NoError(t, err)
	assert.Equal(t, int64(200000), fetchedUpdated.Balance)

	// Test ListByBudget
	list, err := accountRepo.ListByBudget(ctx, "b-1")
	assert.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestCategoryRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	budgetRepo := store.Budgets()
	categoryRepo := store.Categories()

	// Setup Budget
	b := &domain.Budget{
		ID:        "b-1",
		Name:      "Test Budget",
		Method:    domain.MethodZeroSum,
		Currency:  "USD",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, budgetRepo.Create(ctx, b))

	c := &domain.Category{
		ID:          "cat-1",
		BudgetID:    "b-1",
		Name:        "Groceries",
		Budgeted:    50000,
		Balance:     50000,
		TargetLimit: 100000,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Test Create
	err := categoryRepo.Create(ctx, c)
	assert.NoError(t, err)

	// Test GetByID
	fetched, err := categoryRepo.GetByID(ctx, "cat-1")
	assert.NoError(t, err)
	assert.Equal(t, c.ID, fetched.ID)

	// Test Update
	err = categoryRepo.UpdateBudgetedAndBalance(ctx, "cat-1", 60000, 60000)
	assert.NoError(t, err)

	fetchedUpdated, err := categoryRepo.GetByID(ctx, "cat-1")
	assert.NoError(t, err)
	assert.Equal(t, int64(60000), fetchedUpdated.Budgeted)
	assert.Equal(t, int64(60000), fetchedUpdated.Balance)
}

func TestTransactionRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	budgetRepo := store.Budgets()
	accountRepo := store.Accounts()
	categoryRepo := store.Categories()
	txRepo := store.Transactions()

	// Setup structures
	b := &domain.Budget{
		ID:        "b-1",
		Name:      "Test Budget",
		Method:    domain.MethodZeroSum,
		Currency:  "USD",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, budgetRepo.Create(ctx, b))

	acc := &domain.Account{
		ID:        "acc-1",
		BudgetID:  "b-1",
		Name:      "Checking",
		Type:      domain.AccountChecking,
		Balance:   100000,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, accountRepo.Create(ctx, acc))

	cat := &domain.Category{
		ID:        "cat-1",
		BudgetID:  "b-1",
		Name:      "Rent",
		Budgeted:  50000,
		Balance:   50000,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, categoryRepo.Create(ctx, cat))

	// Test Create Transaction
	tx := &domain.Transaction{
		ID:          "tx-1",
		BudgetID:    "b-1",
		AccountID:   "acc-1",
		CategoryID:  "cat-1",
		Amount:      -45000,
		Description: "May Rent",
		Date:        time.Now(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := txRepo.Create(ctx, tx)
	assert.NoError(t, err)

	// Test GetByID
	fetched, err := txRepo.GetByID(ctx, "tx-1")
	assert.NoError(t, err)
	assert.Equal(t, tx.ID, fetched.ID)
	assert.Equal(t, tx.Amount, fetched.Amount)
	assert.Equal(t, tx.CategoryID, fetched.CategoryID)

	// Test List methods
	listByBudget, err := txRepo.ListByBudget(ctx, "b-1")
	assert.NoError(t, err)
	assert.Len(t, listByBudget, 1)

	listByAcc, err := txRepo.ListByAccount(ctx, "acc-1")
	assert.NoError(t, err)
	assert.Len(t, listByAcc, 1)

	listByCat, err := txRepo.ListByCategory(ctx, "cat-1")
	assert.NoError(t, err)
	assert.Len(t, listByCat, 1)

	// Test Update
	tx.Amount = -50000
	tx.Description = "June Rent"
	err = txRepo.Update(ctx, tx)
	assert.NoError(t, err)

	fetchedUpdated, err := txRepo.GetByID(ctx, "tx-1")
	assert.NoError(t, err)
	assert.Equal(t, int64(-50000), fetchedUpdated.Amount)
	assert.Equal(t, "June Rent", fetchedUpdated.Description)

	// Test Delete
	err = txRepo.Delete(ctx, "tx-1")
	assert.NoError(t, err)

	_, err = txRepo.GetByID(ctx, "tx-1")
	assert.Error(t, err)
}

func TestBudgetDeleteNoCascade(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)

	// Create budget
	b := &domain.Budget{
		ID:        "b-1",
		Name:      "Test Budget",
		Method:    domain.MethodZeroSum,
		Currency:  "USD",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, store.Budgets().Create(ctx, b))

	// Create account
	acc := &domain.Account{
		ID:        "acc-1",
		BudgetID:  "b-1",
		Name:      "Checking",
		Type:      domain.AccountChecking,
		Balance:   100000,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, store.Accounts().Create(ctx, acc))

	// Create category
	cat := &domain.Category{
		ID:        "cat-1",
		BudgetID:  "b-1",
		Name:      "Rent",
		Budgeted:  50000,
		Balance:   50000,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, store.Categories().Create(ctx, cat))

	// Create transaction
	tx := &domain.Transaction{
		ID:          "tx-1",
		BudgetID:    "b-1",
		AccountID:   "acc-1",
		CategoryID:  "cat-1",
		Amount:      -45000,
		Description: "Rent",
		Date:        time.Now(),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	require.NoError(t, store.Transactions().Create(ctx, tx))

	// Delete the budget
	err := store.Budgets().Delete(ctx, "b-1")
	assert.NoError(t, err)

	// Verify budget is gone
	_, err = store.Budgets().GetByID(ctx, "b-1")
	assert.Error(t, err)

	// Verify account still exists but budget_id is null/empty
	fetchedAcc, err := store.Accounts().GetByID(ctx, "acc-1")
	assert.NoError(t, err)
	assert.Empty(t, fetchedAcc.BudgetID)

	// Verify category still exists but budget_id is null/empty
	fetchedCat, err := store.Categories().GetByID(ctx, "cat-1")
	assert.NoError(t, err)
	assert.Empty(t, fetchedCat.BudgetID)

	// Verify transaction still exists but budget_id is null/empty
	fetchedTx, err := store.Transactions().GetByID(ctx, "tx-1")
	assert.NoError(t, err)
	assert.Empty(t, fetchedTx.BudgetID)
}

func TestUserRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	repo := store.Users()

	// Test Create
	u := &domain.User{
		ID:           "u-1",
		Email:        "test@example.com",
		PasswordHash: "hashed",
		FirstName:    "John",
		LastName:     "Doe",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	err := repo.Create(ctx, u)
	assert.NoError(t, err)

	// Test GetByID
	fetched, err := repo.GetByID(ctx, "u-1")
	assert.NoError(t, err)
	assert.Equal(t, u.ID, fetched.ID)
	assert.Equal(t, u.Email, fetched.Email)
	assert.Equal(t, u.PasswordHash, fetched.PasswordHash)
	assert.Equal(t, u.FirstName, fetched.FirstName)
	assert.Equal(t, u.LastName, fetched.LastName)
	assert.Empty(t, fetched.BasiqUserID)

	// Test GetByEmail
	fetchedByEmail, err := repo.GetByEmail(ctx, "test@example.com")
	assert.NoError(t, err)
	assert.Equal(t, u.ID, fetchedByEmail.ID)

	// Test GetByEmail Not Found
	_, err = repo.GetByEmail(ctx, "nonexistent@example.com")
	assert.Error(t, err)

	// Test UpdateBasiqUserID
	err = repo.UpdateBasiqUserID(ctx, "u-1", "basiq-user-123")
	assert.NoError(t, err)

	fetchedUpdated, err := repo.GetByID(ctx, "u-1")
	assert.NoError(t, err)
	assert.Equal(t, "basiq-user-123", fetchedUpdated.BasiqUserID)
}

func TestAllocationRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	budgetRepo := store.Budgets()
	accountRepo := store.Accounts()
	categoryRepo := store.Categories()
	allocRepo := store.Allocations()

	// Setup structures
	b := &domain.Budget{
		ID:        "b-1",
		Name:      "Test Budget",
		Method:    domain.MethodEnvelope,
		Currency:  "USD",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, budgetRepo.Create(ctx, b))

	acc := &domain.Account{
		ID:        "acc-1",
		BudgetID:  "b-1",
		Name:      "Checking",
		Type:      domain.AccountChecking,
		Balance:   100000,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, accountRepo.Create(ctx, acc))

	cat := &domain.Category{
		ID:        "cat-1",
		BudgetID:  "b-1",
		Name:      "Groceries",
		Budgeted:  0,
		Balance:   0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, categoryRepo.Create(ctx, cat))

	// Test Upsert
	alloc := &domain.EnvelopeAllocation{
		BudgetID:   "b-1",
		AccountID:  "acc-1",
		CategoryID: "cat-1",
		Amount:     50000,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err := allocRepo.Upsert(ctx, alloc)
	assert.NoError(t, err)

	// Test Get
	fetched, err := allocRepo.Get(ctx, "b-1", "acc-1", "cat-1")
	assert.NoError(t, err)
	assert.Equal(t, alloc.Amount, fetched.Amount)

	// Test ListByBudget
	listBudget, err := allocRepo.ListByBudget(ctx, "b-1")
	assert.NoError(t, err)
	assert.Len(t, listBudget, 1)

	// Test ListByAccount
	listAcc, err := allocRepo.ListByAccount(ctx, "b-1", "acc-1")
	assert.NoError(t, err)
	assert.Len(t, listAcc, 1)

	// Test Delete
	err = allocRepo.Delete(ctx, "b-1", "acc-1", "cat-1")
	assert.NoError(t, err)

	_, err = allocRepo.Get(ctx, "b-1", "acc-1", "cat-1")
	assert.Error(t, err)
}


