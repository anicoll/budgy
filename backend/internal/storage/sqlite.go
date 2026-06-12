package storage

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"time"

	"budgeting_system/internal/domain"

	_ "github.com/ncruces/go-sqlite3/driver"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

// Migrate runs database migrations using Goose.
func Migrate(db *sql.DB) error {
	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect("sqlite3"); err != nil {
		return err
	}
	return goose.Up(db, "migrations")
}

// SQLiteStorage encapsulates the SQL database connection.
type SQLiteStorage struct {
	db *sql.DB
}

// NewSQLiteStorage creates a new SQLiteStorage instance.
func NewSQLiteStorage(db *sql.DB) *SQLiteStorage {
	return &SQLiteStorage{db: db}
}

// Budget Repository Implementation

type budgetRepository struct {
	db *sql.DB
}

func (s *SQLiteStorage) Budgets() BudgetRepository {
	return &budgetRepository{db: s.db}
}

func (r *budgetRepository) Create(ctx context.Context, b *domain.Budget) error {
	query := `INSERT INTO budgets (id, name, method, currency, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, b.ID, b.Name, string(b.Method), b.Currency, b.CreatedAt, b.UpdatedAt)
	return err
}

func (r *budgetRepository) GetByID(ctx context.Context, id string) (*domain.Budget, error) {
	query := `SELECT id, name, method, currency, created_at, updated_at FROM budgets WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	var b domain.Budget
	var methodStr string
	err := row.Scan(&b.ID, &b.Name, &methodStr, &b.Currency, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("budget not found")
		}
		return nil, err
	}
	b.Method = domain.BudgetMethod(methodStr)
	return &b, nil
}

func (r *budgetRepository) List(ctx context.Context) ([]*domain.Budget, error) {
	query := `SELECT id, name, method, currency, created_at, updated_at FROM budgets`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Budget
	for rows.Next() {
		var b domain.Budget
		var methodStr string
		err := rows.Scan(&b.ID, &b.Name, &methodStr, &b.Currency, &b.CreatedAt, &b.UpdatedAt)
		if err != nil {
			return nil, err
		}
		b.Method = domain.BudgetMethod(methodStr)
		list = append(list, &b)
	}
	return list, nil
}

// Account Repository Implementation

type accountRepository struct {
	db *sql.DB
}

func (s *SQLiteStorage) Accounts() AccountRepository {
	return &accountRepository{db: s.db}
}

func (r *accountRepository) Create(ctx context.Context, acc *domain.Account) error {
	query := `INSERT INTO accounts (id, budget_id, name, type, balance, created_at, updated_at, class, account_no, available_funds, product, institution_id, connection_id, last_updated)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	var budgetID interface{} = acc.BudgetID
	if acc.BudgetID == "" {
		budgetID = nil
	}
	_, err := r.db.ExecContext(ctx, query, acc.ID, budgetID, acc.Name, string(acc.Type), acc.Balance, acc.CreatedAt, acc.UpdatedAt, acc.Class, acc.AccountNo, acc.AvailableFunds, acc.Product, acc.InstitutionID, acc.ConnectionID, acc.LastUpdated)
	return err
}

func (r *accountRepository) GetByID(ctx context.Context, id string) (*domain.Account, error) {
	query := `SELECT id, budget_id, name, type, balance, created_at, updated_at, class, account_no, available_funds, product, institution_id, connection_id, last_updated FROM accounts WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	var acc domain.Account
	var typeStr string
	var budgetIDNull sql.NullString
	err := row.Scan(&acc.ID, &budgetIDNull, &acc.Name, &typeStr, &acc.Balance, &acc.CreatedAt, &acc.UpdatedAt, &acc.Class, &acc.AccountNo, &acc.AvailableFunds, &acc.Product, &acc.InstitutionID, &acc.ConnectionID, &acc.LastUpdated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("account not found")
		}
		return nil, err
	}
	acc.Type = domain.AccountType(typeStr)
	acc.BudgetID = budgetIDNull.String
	return &acc, nil
}

func (r *accountRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Account, error) {
	query := `SELECT id, budget_id, name, type, balance, created_at, updated_at, class, account_no, available_funds, product, institution_id, connection_id, last_updated FROM accounts WHERE budget_id = ?`
	rows, err := r.db.QueryContext(ctx, query, budgetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Account
	for rows.Next() {
		var acc domain.Account
		var typeStr string
		var budgetIDNull sql.NullString
		err := rows.Scan(&acc.ID, &budgetIDNull, &acc.Name, &typeStr, &acc.Balance, &acc.CreatedAt, &acc.UpdatedAt, &acc.Class, &acc.AccountNo, &acc.AvailableFunds, &acc.Product, &acc.InstitutionID, &acc.ConnectionID, &acc.LastUpdated)
		if err != nil {
			return nil, err
		}
		acc.Type = domain.AccountType(typeStr)
		acc.BudgetID = budgetIDNull.String
		list = append(list, &acc)
	}
	return list, nil
}

func (r *accountRepository) UpdateBalance(ctx context.Context, id string, balance int64) error {
	query := `UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, balance, time.Now(), id)
	return err
}

// Category Repository Implementation

type categoryRepository struct {
	db *sql.DB
}

func (s *SQLiteStorage) Categories() CategoryRepository {
	return &categoryRepository{db: s.db}
}

func (r *categoryRepository) Create(ctx context.Context, c *domain.Category) error {
	query := `INSERT INTO categories (id, budget_id, name, budgeted, balance, target_limit, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, c.ID, c.BudgetID, c.Name, c.Budgeted, c.Balance, c.TargetLimit, c.CreatedAt, c.UpdatedAt)
	return err
}

func (r *categoryRepository) GetByID(ctx context.Context, id string) (*domain.Category, error) {
	query := `SELECT id, budget_id, name, budgeted, balance, target_limit, created_at, updated_at FROM categories WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	var c domain.Category
	var budgetIDNull sql.NullString
	err := row.Scan(&c.ID, &budgetIDNull, &c.Name, &c.Budgeted, &c.Balance, &c.TargetLimit, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("category not found")
		}
		return nil, err
	}
	c.BudgetID = budgetIDNull.String
	return &c, nil
}

func (r *categoryRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Category, error) {
	query := `SELECT id, budget_id, name, budgeted, balance, target_limit, created_at, updated_at FROM categories WHERE budget_id = ?`
	rows, err := r.db.QueryContext(ctx, query, budgetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Category
	for rows.Next() {
		var c domain.Category
		var budgetIDNull sql.NullString
		err := rows.Scan(&c.ID, &budgetIDNull, &c.Name, &c.Budgeted, &c.Balance, &c.TargetLimit, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			return nil, err
		}
		c.BudgetID = budgetIDNull.String
		list = append(list, &c)
	}
	return list, nil
}

func (r *categoryRepository) UpdateBudgetedAndBalance(ctx context.Context, id string, budgeted int64, balance int64) error {
	query := `UPDATE categories SET budgeted = ?, balance = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, budgeted, balance, time.Now(), id)
	return err
}

// Transaction Repository Implementation

type transactionRepository struct {
	db *sql.DB
}

func (s *SQLiteStorage) Transactions() TransactionRepository {
	return &transactionRepository{db: s.db}
}

func (r *transactionRepository) Create(ctx context.Context, tx *domain.Transaction) error {
	query := `INSERT INTO transactions (id, budget_id, account_id, category_id, amount, description, date, created_at, updated_at, direction, status, class, post_date, sub_class, raw_description, merchant_name)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	var catID interface{} = tx.CategoryID
	if tx.CategoryID == "" {
		catID = nil
	}
	var budgetID interface{} = tx.BudgetID
	if tx.BudgetID == "" {
		budgetID = nil
	}
	_, err := r.db.ExecContext(ctx, query, tx.ID, budgetID, tx.AccountID, catID, tx.Amount, tx.Description, tx.Date, tx.CreatedAt, tx.UpdatedAt, tx.Direction, tx.Status, tx.Class, tx.PostDate, tx.SubClass, tx.RawDescription, tx.MerchantName)
	return err
}

func (r *transactionRepository) GetByID(ctx context.Context, id string) (*domain.Transaction, error) {
	query := `SELECT id, budget_id, account_id, category_id, amount, description, date, created_at, updated_at, direction, status, class, post_date, sub_class, raw_description, merchant_name FROM transactions WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	var tx domain.Transaction
	var catID sql.NullString
	var budgetIDNull sql.NullString
	err := row.Scan(&tx.ID, &budgetIDNull, &tx.AccountID, &catID, &tx.Amount, &tx.Description, &tx.Date, &tx.CreatedAt, &tx.UpdatedAt, &tx.Direction, &tx.Status, &tx.Class, &tx.PostDate, &tx.SubClass, &tx.RawDescription, &tx.MerchantName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("transaction not found")
		}
		return nil, err
	}
	if catID.Valid {
		tx.CategoryID = catID.String
	}
	tx.BudgetID = budgetIDNull.String
	return &tx, nil
}

func (r *transactionRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Transaction, error) {
	query := `SELECT id, budget_id, account_id, category_id, amount, description, date, created_at, updated_at, direction, status, class, post_date, sub_class, raw_description, merchant_name FROM transactions WHERE budget_id = ?`
	return r.listQuery(ctx, query, budgetID)
}

func (r *transactionRepository) ListByAccount(ctx context.Context, accountID string) ([]*domain.Transaction, error) {
	query := `SELECT id, budget_id, account_id, category_id, amount, description, date, created_at, updated_at, direction, status, class, post_date, sub_class, raw_description, merchant_name FROM transactions WHERE account_id = ?`
	return r.listQuery(ctx, query, accountID)
}

func (r *transactionRepository) ListByCategory(ctx context.Context, categoryID string) ([]*domain.Transaction, error) {
	query := `SELECT id, budget_id, account_id, category_id, amount, description, date, created_at, updated_at, direction, status, class, post_date, sub_class, raw_description, merchant_name FROM transactions WHERE category_id = ?`
	return r.listQuery(ctx, query, categoryID)
}

func (r *transactionRepository) listQuery(ctx context.Context, query string, arg interface{}) ([]*domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Transaction
	for rows.Next() {
		var tx domain.Transaction
		var catID sql.NullString
		var budgetIDNull sql.NullString
		err := rows.Scan(&tx.ID, &budgetIDNull, &tx.AccountID, &catID, &tx.Amount, &tx.Description, &tx.Date, &tx.CreatedAt, &tx.UpdatedAt, &tx.Direction, &tx.Status, &tx.Class, &tx.PostDate, &tx.SubClass, &tx.RawDescription, &tx.MerchantName)
		if err != nil {
			return nil, err
		}
		if catID.Valid {
			tx.CategoryID = catID.String
		}
		tx.BudgetID = budgetIDNull.String
		list = append(list, &tx)
	}
	return list, nil
}
