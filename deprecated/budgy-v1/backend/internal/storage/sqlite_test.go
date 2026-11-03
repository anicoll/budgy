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
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	err = Migrate(db)
	require.NoError(t, err)
	return db
}

func setupUser(t *testing.T, store *SQLiteStorage, userID string) {
	t.Helper()
	ctx := context.Background()
	u := &domain.User{
		ID:        userID,
		Email:     userID + "@example.com",
		FirstName: "Test",
		LastName:  "User",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, store.Users().Create(ctx, u))
}

func setupBudget(t *testing.T, store *SQLiteStorage, userID, budgetID string) {
	t.Helper()
	ctx := context.Background()
	b := &domain.Budget{
		ID:        budgetID,
		UserID:    userID,
		Name:      "Test Budget",
		Method:    domain.MethodZeroSum,
		Currency:  "USD",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, store.Budgets().Create(ctx, b))
}

func TestBudgetRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	repo := store.Budgets()
	setupUser(t, store, "user-1")

	b := &domain.Budget{
		ID:        "b-1",
		UserID:    "user-1",
		Name:      "Test Budget",
		Method:    domain.MethodZeroSum,
		Currency:  "USD",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, repo.Create(ctx, b))

	fetched, err := repo.GetByID(ctx, "b-1")
	require.NoError(t, err)
	assert.Equal(t, b.ID, fetched.ID)

	list, err := repo.List(ctx, "user-1")
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestAccountRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	setupUser(t, store, "user-1")
	setupBudget(t, store, "user-1", "b-1")

	accountRepo := store.Accounts()
	acc := &domain.Account{
		ID:        "acc-1",
		UserID:    "user-1",
		Name:      "Checking",
		Type:      domain.AccountChecking,
		Balance:   150000,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, accountRepo.Create(ctx, acc))
	require.NoError(t, store.BudgetAccounts().Link(ctx, "b-1", "acc-1"))

	fetched, err := accountRepo.GetByID(ctx, "acc-1")
	require.NoError(t, err)
	assert.Equal(t, acc.UserID, fetched.UserID)

	require.NoError(t, accountRepo.UpdateBalance(ctx, "acc-1", 200000))
	fetchedUpdated, err := accountRepo.GetByID(ctx, "acc-1")
	require.NoError(t, err)
	assert.Equal(t, int64(200000), fetchedUpdated.Balance)

	list, err := accountRepo.ListByBudget(ctx, "b-1")
	require.NoError(t, err)
	assert.Len(t, list, 1)

	userList, err := accountRepo.ListByUser(ctx, "user-1")
	require.NoError(t, err)
	assert.Len(t, userList, 1)
}

func TestCategoryRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	setupUser(t, store, "user-1")
	setupBudget(t, store, "user-1", "b-1")

	categoryRepo := store.Categories()
	lineRepo := store.BudgetCategoryLines()

	c := &domain.Category{
		ID:        "cat-1",
		UserID:    "user-1",
		Name:      "Groceries",
		Type:      domain.CategoryExpense,
		Color:     "#34d399",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, categoryRepo.Create(ctx, c))
	require.NoError(t, lineRepo.Upsert(ctx, &domain.BudgetCategoryLine{
		BudgetID: "b-1", CategoryID: "cat-1",
		Budgeted: 50000, Balance: 50000, TargetLimit: 100000,
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))

	fetched, err := categoryRepo.GetByID(ctx, "cat-1")
	require.NoError(t, err)
	assert.Equal(t, c.Name, fetched.Name)

	require.NoError(t, lineRepo.UpdateBudgetedAndBalance(ctx, "b-1", "cat-1", 60000, 60000))
	line, err := lineRepo.Get(ctx, "b-1", "cat-1")
	require.NoError(t, err)
	assert.Equal(t, int64(60000), line.Budgeted)
	assert.Equal(t, int64(60000), line.Balance)

	list, err := categoryRepo.ListByUser(ctx, "user-1")
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestTransactionRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	setupUser(t, store, "user-1")
	setupBudget(t, store, "user-1", "b-1")

	require.NoError(t, store.Accounts().Create(ctx, &domain.Account{
		ID: "acc-1", UserID: "user-1", Name: "Checking", Type: domain.AccountChecking,
		Balance: 100000, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))
	require.NoError(t, store.BudgetAccounts().Link(ctx, "b-1", "acc-1"))
	require.NoError(t, store.Categories().Create(ctx, &domain.Category{
		ID: "cat-1", UserID: "user-1", Name: "Rent", Type: domain.CategoryExpense,
		Color: "#7c5cff", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))

	txRepo := store.Transactions()
	tx := &domain.Transaction{
		ID: "tx-1", AccountID: "acc-1", CategoryID: "cat-1",
		Amount: -45000, Description: "May Rent", Date: time.Now(),
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	require.NoError(t, txRepo.Create(ctx, tx))

	fetched, err := txRepo.GetByID(ctx, "tx-1")
	require.NoError(t, err)
	assert.Equal(t, tx.Amount, fetched.Amount)

	listByBudget, err := txRepo.ListByBudget(ctx, "b-1")
	require.NoError(t, err)
	assert.Len(t, listByBudget, 1)

	listByUser, err := txRepo.ListByUser(ctx, "user-1")
	require.NoError(t, err)
	assert.Len(t, listByUser, 1)

	require.NoError(t, txRepo.Delete(ctx, "tx-1"))
	_, err = txRepo.GetByID(ctx, "tx-1")
	assert.Error(t, err)
}

func TestTransactionListByUserIncludesUnlinkedAccounts(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	setupUser(t, store, "user-1")
	setupBudget(t, store, "user-1", "b-1")

	require.NoError(t, store.Accounts().Create(ctx, &domain.Account{
		ID: "acc-unlinked", UserID: "user-1", Name: "Savings", Type: domain.AccountSavings,
		Balance: 50000, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))
	require.NoError(t, store.Categories().Create(ctx, &domain.Category{
		ID: "cat-1", UserID: "user-1", Name: "Groceries", Type: domain.CategoryExpense,
		Color: "#34d399", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))

	txRepo := store.Transactions()
	tx := &domain.Transaction{
		ID: "tx-unlinked", AccountID: "acc-unlinked", CategoryID: "cat-1",
		Amount: -2500, Description: "Coffee", Date: time.Now(),
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	require.NoError(t, txRepo.Create(ctx, tx))

	listByUser, err := txRepo.ListByUser(ctx, "user-1")
	require.NoError(t, err)
	assert.Len(t, listByUser, 1)

	listByBudget, err := txRepo.ListByBudget(ctx, "b-1")
	require.NoError(t, err)
	assert.Empty(t, listByBudget)
}

func TestBudgetDeleteCascadeLinks(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	setupUser(t, store, "user-1")
	setupBudget(t, store, "user-1", "b-1")

	require.NoError(t, store.Accounts().Create(ctx, &domain.Account{
		ID: "acc-1", UserID: "user-1", Name: "Checking", Type: domain.AccountChecking,
		Balance: 100000, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))
	require.NoError(t, store.BudgetAccounts().Link(ctx, "b-1", "acc-1"))
	require.NoError(t, store.Categories().Create(ctx, &domain.Category{
		ID: "cat-1", UserID: "user-1", Name: "Rent", Type: domain.CategoryExpense,
		Color: "#7c5cff", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))
	require.NoError(t, store.BudgetCategoryLines().Upsert(ctx, &domain.BudgetCategoryLine{
		BudgetID: "b-1", CategoryID: "cat-1", Budgeted: 50000, Balance: 50000,
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))

	require.NoError(t, store.Budgets().Delete(ctx, "b-1"))

	_, err := store.Budgets().GetByID(ctx, "b-1")
	assert.Error(t, err)

	fetchedAcc, err := store.Accounts().GetByID(ctx, "acc-1")
	require.NoError(t, err)
	assert.Equal(t, "user-1", fetchedAcc.UserID)

	fetchedCat, err := store.Categories().GetByID(ctx, "cat-1")
	require.NoError(t, err)
	assert.Equal(t, "user-1", fetchedCat.UserID)

	list, err := store.BudgetAccounts().ListByBudget(ctx, "b-1")
	require.NoError(t, err)
	assert.Empty(t, list)
}

func TestUserRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	repo := store.Users()

	u := &domain.User{
		ID: "u-1", Email: "test@example.com", PasswordHash: "hashed",
		FirstName: "John", LastName: "Doe", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	require.NoError(t, repo.Create(ctx, u))

	fetched, err := repo.GetByID(ctx, "u-1")
	require.NoError(t, err)
	assert.Equal(t, u.Email, fetched.Email)

	require.NoError(t, repo.UpdateBasiqUserID(ctx, "u-1", "basiq-user-123"))
	fetchedUpdated, err := repo.GetByID(ctx, "u-1")
	require.NoError(t, err)
	assert.Equal(t, "basiq-user-123", fetchedUpdated.BasiqUserID)
}

func TestAllocationRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	setupUser(t, store, "user-1")
	setupBudget(t, store, "user-1", "b-1")

	require.NoError(t, store.Accounts().Create(ctx, &domain.Account{
		ID: "acc-1", UserID: "user-1", Name: "Checking", Type: domain.AccountChecking,
		Balance: 100000, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))
	require.NoError(t, store.Categories().Create(ctx, &domain.Category{
		ID: "cat-1", UserID: "user-1", Name: "Groceries", Type: domain.CategoryExpense,
		Color: "#34d399", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}))

	allocRepo := store.Allocations()
	alloc := &domain.EnvelopeAllocation{
		BudgetID: "b-1", AccountID: "acc-1", CategoryID: "cat-1", Amount: 50000,
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	require.NoError(t, allocRepo.Upsert(ctx, alloc))

	fetched, err := allocRepo.Get(ctx, "b-1", "acc-1", "cat-1")
	require.NoError(t, err)
	assert.Equal(t, alloc.Amount, fetched.Amount)

	require.NoError(t, allocRepo.Delete(ctx, "b-1", "acc-1", "cat-1"))
	_, err = allocRepo.Get(ctx, "b-1", "acc-1", "cat-1")
	assert.Error(t, err)
}

func TestJobRepository(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	ctx := context.Background()
	store := NewSQLiteStorage(db)
	repo := store.Jobs()

	job := &domain.Job{
		ID: "job-1", JobType: "sync_basiq_user", Payload: `{"user_id":"u-1"}`,
		Status: domain.JobStatusPending, Attempts: 0, MaxAttempts: 5,
		RunAt: time.Now().Add(-1 * time.Minute), CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	require.NoError(t, repo.Create(ctx, job))

	fetched, err := repo.GetNextPending(ctx)
	require.NoError(t, err)
	assert.Equal(t, job.ID, fetched.ID)

	require.NoError(t, repo.Delete(ctx, "job-1"))
	_, err = repo.GetNextPending(ctx)
	assert.Error(t, err)
}

func TestCategorySeedIdempotent(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()

	store := NewSQLiteStorage(db)
	setupUser(t, store, "user-1")

	ctx := context.Background()
	require.NoError(t, store.SeedCategoriesForUser(ctx, "user-1"))
	list1, err := store.Categories().ListByUser(ctx, "user-1")
	require.NoError(t, err)
	assert.NotEmpty(t, list1)

	require.NoError(t, store.SeedCategoriesForUser(ctx, "user-1"))
	list2, err := store.Categories().ListByUser(ctx, "user-1")
	require.NoError(t, err)
	assert.Len(t, list2, len(list1))
}
