package storage

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"time"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/mappings"
	"budgeting_system/internal/storage/db"
	"budgeting_system/pkg/utils"

	_ "github.com/ncruces/go-sqlite3/driver"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

var (
	dbTxMapper       mappings.DBTransactionMapper
	dbUserMapper     mappings.DBUserMapper
	dbBudgetMapper   mappings.DBBudgetMapper
	dbAccountMapper  mappings.DBAccountMapper
	dbCategoryMapper mappings.DBCategoryMapper
	dbJobMapper      mappings.DBJobMapper
)

func init() {
	mappers := mappings.NewMappers()
	mappers.Add("NullStringConverter", &mappings.NullStringConverter{})
	mappers.Add("NullTimeConverter", &mappings.NullTimeConverter{})
	mappers.Add("NullInt64Converter", &mappings.NullInt64Converter{})
	mappers.Add("DBJobMapperHelper", &mappings.DBJobMapperHelperImpl{})

	dbTxMapper = utils.Must(mappers.Get("budgeting_system/internal/mappings.DBTransactionMapper")).(mappings.DBTransactionMapper)
	dbUserMapper = utils.Must(mappers.Get("budgeting_system/internal/mappings.DBUserMapper")).(mappings.DBUserMapper)
	dbBudgetMapper = utils.Must(mappers.Get("budgeting_system/internal/mappings.DBBudgetMapper")).(mappings.DBBudgetMapper)
	dbAccountMapper = utils.Must(mappers.Get("budgeting_system/internal/mappings.DBAccountMapper")).(mappings.DBAccountMapper)
	dbCategoryMapper = utils.Must(mappers.Get("budgeting_system/internal/mappings.DBCategoryMapper")).(mappings.DBCategoryMapper)
	dbJobMapper = utils.Must(mappers.Get("budgeting_system/internal/mappings.DBJobMapper")).(mappings.DBJobMapper)
}

// Migrate runs database migrations using Goose.
func Migrate(db *sql.DB) error {
	return MigrateWithDialect(db, "sqlite3")
}

// MigrateWithDialect runs database migrations using Goose with a specific dialect.
func MigrateWithDialect(db *sql.DB, dialect string) error {
	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect(dialect); err != nil {
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

func (s *SQLiteStorage) Budgets() domain.BudgetRepository {
	return &budgetRepository{db: s.db}
}

func (s *SQLiteStorage) Users() domain.UserRepository {
	return &userRepository{db: s.db}
}

func (s *SQLiteStorage) Allocations() domain.AllocationRepository {
	return &allocationRepository{db: s.db}
}

func (s *SQLiteStorage) Jobs() domain.JobRepository {
	return &jobRepository{db: s.db}
}

func (r *budgetRepository) Create(ctx context.Context, b *domain.Budget) error {
	query := `INSERT INTO budgets (id, user_id, name, method, currency, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?)`
	var userID any = b.UserID
	if b.UserID == "" {
		userID = nil
	}
	_, err := r.db.ExecContext(ctx, query, b.ID, userID, b.Name, string(b.Method), b.Currency, b.CreatedAt, b.UpdatedAt)
	return err
}

func (r *budgetRepository) GetByID(ctx context.Context, id string) (*domain.Budget, error) {
	query := `SELECT id, user_id, name, method, currency, created_at, updated_at FROM budgets WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	var dbBudget db.Budget
	err := row.Scan(&dbBudget.ID, &dbBudget.UserID, &dbBudget.Name, &dbBudget.Method, &dbBudget.Currency, &dbBudget.CreatedAt, &dbBudget.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("budget not found")
		}
		return nil, err
	}
	var b domain.Budget
	if err := dbBudgetMapper.BudgetToBudget(ctx, &dbBudget, &b); err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *budgetRepository) List(ctx context.Context, userID string) ([]*domain.Budget, error) {
	query := `SELECT id, user_id, name, method, currency, created_at, updated_at FROM budgets WHERE user_id = ?`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Budget
	for rows.Next() {
		var dbBudget db.Budget
		err := rows.Scan(&dbBudget.ID, &dbBudget.UserID, &dbBudget.Name, &dbBudget.Method, &dbBudget.Currency, &dbBudget.CreatedAt, &dbBudget.UpdatedAt)
		if err != nil {
			return nil, err
		}
		var b domain.Budget
		if err := dbBudgetMapper.BudgetToBudget(ctx, &dbBudget, &b); err != nil {
			return nil, err
		}
		list = append(list, &b)
	}
	return list, nil
}

func (r *budgetRepository) Update(ctx context.Context, b *domain.Budget) error {
	query := `UPDATE budgets SET user_id = ?, name = ?, method = ?, currency = ?, updated_at = ? WHERE id = ?`
	var userID any = b.UserID
	if b.UserID == "" {
		userID = nil
	}
	_, err := r.db.ExecContext(ctx, query, userID, b.Name, string(b.Method), b.Currency, b.UpdatedAt, b.ID)
	return err
}

func (r *budgetRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM budgets WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// Account Repository Implementation

type accountRepository struct {
	db *sql.DB
}

func (s *SQLiteStorage) Accounts() domain.AccountRepository {
	return &accountRepository{db: s.db}
}

func (r *accountRepository) Create(ctx context.Context, acc *domain.Account) error {
	query := `INSERT INTO accounts (id, budget_id, name, type, balance, created_at, updated_at, class, account_no, available_funds, product, institution_id, connection_id, last_updated)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	var budgetID any = acc.BudgetID
	if acc.BudgetID == "" {
		budgetID = nil
	}
	_, err := r.db.ExecContext(ctx, query, acc.ID, budgetID, acc.Name, string(acc.Type), acc.Balance, acc.CreatedAt, acc.UpdatedAt, acc.Class, acc.AccountNo, acc.AvailableFunds, acc.Product, acc.InstitutionID, acc.ConnectionID, acc.LastUpdated)
	return err
}

func (r *accountRepository) GetByID(ctx context.Context, id string) (*domain.Account, error) {
	query := `SELECT id, budget_id, name, type, balance, created_at, updated_at, class, account_no, available_funds, product, institution_id, connection_id, last_updated FROM accounts WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	var dbAcc db.Account
	err := row.Scan(&dbAcc.ID, &dbAcc.BudgetID, &dbAcc.Name, &dbAcc.Type, &dbAcc.Balance, &dbAcc.CreatedAt, &dbAcc.UpdatedAt, &dbAcc.Class, &dbAcc.AccountNo, &dbAcc.AvailableFunds, &dbAcc.Product, &dbAcc.InstitutionID, &dbAcc.ConnectionID, &dbAcc.LastUpdated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("account not found")
		}
		return nil, err
	}
	var acc domain.Account
	if err := dbAccountMapper.AccountToAccount(ctx, &dbAcc, &acc); err != nil {
		return nil, err
	}
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
		var dbAcc db.Account
		err := rows.Scan(&dbAcc.ID, &dbAcc.BudgetID, &dbAcc.Name, &dbAcc.Type, &dbAcc.Balance, &dbAcc.CreatedAt, &dbAcc.UpdatedAt, &dbAcc.Class, &dbAcc.AccountNo, &dbAcc.AvailableFunds, &dbAcc.Product, &dbAcc.InstitutionID, &dbAcc.ConnectionID, &dbAcc.LastUpdated)
		if err != nil {
			return nil, err
		}
		var acc domain.Account
		if err := dbAccountMapper.AccountToAccount(ctx, &dbAcc, &acc); err != nil {
			return nil, err
		}
		list = append(list, &acc)
	}
	return list, nil
}

func (r *accountRepository) UpdateBalance(ctx context.Context, id string, balance int64) error {
	query := `UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, balance, time.Now(), id)
	return err
}

func (r *accountRepository) Update(ctx context.Context, acc *domain.Account) error {
	query := `UPDATE accounts SET budget_id = ?, name = ?, type = ?, balance = ?, updated_at = ?, class = ?, account_no = ?, available_funds = ?, product = ?, institution_id = ?, connection_id = ?, last_updated = ? WHERE id = ?`
	var budgetID any = acc.BudgetID
	if acc.BudgetID == "" {
		budgetID = nil
	}
	_, err := r.db.ExecContext(ctx, query, budgetID, acc.Name, string(acc.Type), acc.Balance, acc.UpdatedAt, acc.Class, acc.AccountNo, acc.AvailableFunds, acc.Product, acc.InstitutionID, acc.ConnectionID, acc.LastUpdated, acc.ID)
	return err
}

func (r *accountRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM accounts WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// Category Repository Implementation

type categoryRepository struct {
	db *sql.DB
}

func (s *SQLiteStorage) Categories() domain.CategoryRepository {
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

	var dbC db.Category
	err := row.Scan(&dbC.ID, &dbC.BudgetID, &dbC.Name, &dbC.Budgeted, &dbC.Balance, &dbC.TargetLimit, &dbC.CreatedAt, &dbC.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("category not found")
		}
		return nil, err
	}
	var c domain.Category
	if err := dbCategoryMapper.CategoryToCategory(ctx, &dbC, &c); err != nil {
		return nil, err
	}
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
		var dbC db.Category
		err := rows.Scan(&dbC.ID, &dbC.BudgetID, &dbC.Name, &dbC.Budgeted, &dbC.Balance, &dbC.TargetLimit, &dbC.CreatedAt, &dbC.UpdatedAt)
		if err != nil {
			return nil, err
		}
		var c domain.Category
		if err := dbCategoryMapper.CategoryToCategory(ctx, &dbC, &c); err != nil {
			return nil, err
		}
		list = append(list, &c)
	}
	return list, nil
}

func (r *categoryRepository) UpdateBudgetedAndBalance(ctx context.Context, id string, budgeted int64, balance int64) error {
	query := `UPDATE categories SET budgeted = ?, balance = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, budgeted, balance, time.Now(), id)
	return err
}

func (r *categoryRepository) Update(ctx context.Context, c *domain.Category) error {
	query := `UPDATE categories SET budget_id = ?, name = ?, budgeted = ?, balance = ?, target_limit = ?, updated_at = ? WHERE id = ?`
	var budgetID any = c.BudgetID
	if c.BudgetID == "" {
		budgetID = nil
	}
	_, err := r.db.ExecContext(ctx, query, budgetID, c.Name, c.Budgeted, c.Balance, c.TargetLimit, c.UpdatedAt, c.ID)
	return err
}

func (r *categoryRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM categories WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// Transaction Repository Implementation

type transactionRepository struct {
	db *sql.DB
}

func (s *SQLiteStorage) Transactions() domain.TransactionRepository {
	return &transactionRepository{db: s.db}
}

func (r *transactionRepository) Create(ctx context.Context, tx *domain.Transaction) error {
	query := `INSERT INTO transactions (id, account_id, category_id, amount, description, date, created_at, updated_at, direction, status, class, post_date, sub_class, raw_description, merchant_name, merchant_website, merchant_logo_url, location_address, location_lat, location_lng, category_code, category_title)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	var catID any = tx.CategoryID
	if tx.CategoryID == "" {
		catID = nil
	}
	_, err := r.db.ExecContext(ctx, query, tx.ID, tx.AccountID, catID, tx.Amount, tx.Description, tx.Date, tx.CreatedAt, tx.UpdatedAt, tx.Direction, tx.Status, tx.Class, tx.PostDate, tx.SubClass, tx.RawDescription, tx.MerchantName, tx.MerchantWebsite, tx.MerchantLogoURL, tx.LocationAddress, tx.LocationLat, tx.LocationLng, tx.CategoryCode, tx.CategoryTitle)
	return err
}

func (r *transactionRepository) GetByID(ctx context.Context, id string) (*domain.Transaction, error) {
	query := `SELECT t.id, a.budget_id, t.account_id, t.category_id, t.amount, t.description, t.date, t.created_at, t.updated_at, t.direction, t.status, t.class, t.post_date, t.sub_class, t.raw_description, t.merchant_name, t.merchant_website, t.merchant_logo_url, t.location_address, t.location_lat, t.location_lng, t.category_code, t.category_title 
	          FROM transactions t
	          JOIN accounts a ON t.account_id = a.id
	          WHERE t.id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	var dbTx db.Transaction
	var budgetIDNull sql.NullString
	err := row.Scan(
		&dbTx.ID,
		&budgetIDNull,
		&dbTx.AccountID,
		&dbTx.CategoryID,
		&dbTx.Amount,
		&dbTx.Description,
		&dbTx.Date,
		&dbTx.CreatedAt,
		&dbTx.UpdatedAt,
		&dbTx.Direction,
		&dbTx.Status,
		&dbTx.Class,
		&dbTx.PostDate,
		&dbTx.SubClass,
		&dbTx.RawDescription,
		&dbTx.MerchantName,
		&dbTx.MerchantWebsite,
		&dbTx.MerchantLogoUrl,
		&dbTx.LocationAddress,
		&dbTx.LocationLat,
		&dbTx.LocationLng,
		&dbTx.CategoryCode,
		&dbTx.CategoryTitle,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("transaction not found")
		}
		return nil, err
	}
	var tx domain.Transaction
	if err := dbTxMapper.TransactionToTransaction(ctx, &dbTx, &tx); err != nil {
		return nil, err
	}
	tx.BudgetID = budgetIDNull.String
	return &tx, nil
}

func (r *transactionRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Transaction, error) {
	query := `SELECT t.id, a.budget_id, t.account_id, t.category_id, t.amount, t.description, t.date, t.created_at, t.updated_at, t.direction, t.status, t.class, t.post_date, t.sub_class, t.raw_description, t.merchant_name, t.merchant_website, t.merchant_logo_url, t.location_address, t.location_lat, t.location_lng, t.category_code, t.category_title 
	          FROM transactions t
	          JOIN accounts a ON t.account_id = a.id
	          WHERE a.budget_id = ?`
	return r.listQuery(ctx, query, budgetID)
}

func (r *transactionRepository) ListByAccount(ctx context.Context, accountID string) ([]*domain.Transaction, error) {
	query := `SELECT t.id, a.budget_id, t.account_id, t.category_id, t.amount, t.description, t.date, t.created_at, t.updated_at, t.direction, t.status, t.class, t.post_date, t.sub_class, t.raw_description, t.merchant_name, t.merchant_website, t.merchant_logo_url, t.location_address, t.location_lat, t.location_lng, t.category_code, t.category_title 
	          FROM transactions t
	          JOIN accounts a ON t.account_id = a.id
	          WHERE t.account_id = ?`
	return r.listQuery(ctx, query, accountID)
}

func (r *transactionRepository) ListByCategory(ctx context.Context, categoryID string) ([]*domain.Transaction, error) {
	query := `SELECT t.id, a.budget_id, t.account_id, t.category_id, t.amount, t.description, t.date, t.created_at, t.updated_at, t.direction, t.status, t.class, t.post_date, t.sub_class, t.raw_description, t.merchant_name, t.merchant_website, t.merchant_logo_url, t.location_address, t.location_lat, t.location_lng, t.category_code, t.category_title 
	          FROM transactions t
	          JOIN accounts a ON t.account_id = a.id
	          WHERE t.category_id = ?`
	return r.listQuery(ctx, query, categoryID)
}

func (r *transactionRepository) listQuery(ctx context.Context, query string, arg any) ([]*domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Transaction
	for rows.Next() {
		var dbTx db.Transaction
		var budgetIDNull sql.NullString
		err := rows.Scan(
			&dbTx.ID,
			&budgetIDNull,
			&dbTx.AccountID,
			&dbTx.CategoryID,
			&dbTx.Amount,
			&dbTx.Description,
			&dbTx.Date,
			&dbTx.CreatedAt,
			&dbTx.UpdatedAt,
			&dbTx.Direction,
			&dbTx.Status,
			&dbTx.Class,
			&dbTx.PostDate,
			&dbTx.SubClass,
			&dbTx.RawDescription,
			&dbTx.MerchantName,
			&dbTx.MerchantWebsite,
			&dbTx.MerchantLogoUrl,
			&dbTx.LocationAddress,
			&dbTx.LocationLat,
			&dbTx.LocationLng,
			&dbTx.CategoryCode,
			&dbTx.CategoryTitle,
		)
		if err != nil {
			return nil, err
		}
		var tx domain.Transaction
		if err := dbTxMapper.TransactionToTransaction(ctx, &dbTx, &tx); err != nil {
			return nil, err
		}
		tx.BudgetID = budgetIDNull.String
		list = append(list, &tx)
	}
	return list, nil
}

func (r *transactionRepository) Update(ctx context.Context, tx *domain.Transaction) error {
	query := `UPDATE transactions SET account_id = ?, category_id = ?, amount = ?, description = ?, date = ?, updated_at = ?, direction = ?, status = ?, class = ?, post_date = ?, sub_class = ?, raw_description = ?, merchant_name = ?, merchant_website = ?, merchant_logo_url = ?, location_address = ?, location_lat = ?, location_lng = ?, category_code = ?, category_title = ? WHERE id = ?`
	var catID any = tx.CategoryID
	if tx.CategoryID == "" {
		catID = nil
	}
	_, err := r.db.ExecContext(ctx, query, tx.AccountID, catID, tx.Amount, tx.Description, tx.Date, tx.UpdatedAt, tx.Direction, tx.Status, tx.Class, tx.PostDate, tx.SubClass, tx.RawDescription, tx.MerchantName, tx.MerchantWebsite, tx.MerchantLogoURL, tx.LocationAddress, tx.LocationLat, tx.LocationLng, tx.CategoryCode, tx.CategoryTitle, tx.ID)
	return err
}

func (r *transactionRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM transactions WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// User Repository Implementation

type userRepository struct {
	db *sql.DB
}

func (r *userRepository) Create(ctx context.Context, u *domain.User) error {
	query := `INSERT INTO users (id, email, password_hash, first_name, last_name, basiq_user_id, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	var basiqID any = u.BasiqUserID
	if u.BasiqUserID == "" {
		basiqID = nil
	}
	_, err := r.db.ExecContext(ctx, query, u.ID, u.Email, u.PasswordHash, u.FirstName, u.LastName, basiqID, u.CreatedAt, u.UpdatedAt)
	return err
}

func (r *userRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	query := `SELECT id, email, password_hash, first_name, last_name, basiq_user_id, created_at, updated_at FROM users WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	var dbU db.User
	err := row.Scan(&dbU.ID, &dbU.Email, &dbU.PasswordHash, &dbU.FirstName, &dbU.LastName, &dbU.BasiqUserID, &dbU.CreatedAt, &dbU.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	var u domain.User
	if err := dbUserMapper.UserToUser(ctx, &dbU, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `SELECT id, email, password_hash, first_name, last_name, basiq_user_id, created_at, updated_at FROM users WHERE email = ?`
	row := r.db.QueryRowContext(ctx, query, email)

	var dbU db.User
	err := row.Scan(&dbU.ID, &dbU.Email, &dbU.PasswordHash, &dbU.FirstName, &dbU.LastName, &dbU.BasiqUserID, &dbU.CreatedAt, &dbU.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	var u domain.User
	if err := dbUserMapper.UserToUser(ctx, &dbU, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *userRepository) GetByBasiqUserID(ctx context.Context, basiqID string) (*domain.User, error) {
	query := `SELECT id, email, password_hash, first_name, last_name, basiq_user_id, created_at, updated_at FROM users WHERE basiq_user_id = ?`
	row := r.db.QueryRowContext(ctx, query, basiqID)

	var dbU db.User
	err := row.Scan(&dbU.ID, &dbU.Email, &dbU.PasswordHash, &dbU.FirstName, &dbU.LastName, &dbU.BasiqUserID, &dbU.CreatedAt, &dbU.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	var u domain.User
	if err := dbUserMapper.UserToUser(ctx, &dbU, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *userRepository) UpdateBasiqUserID(ctx context.Context, id string, basiqID string) error {
	query := `UPDATE users SET basiq_user_id = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, basiqID, time.Now(), id)
	return err
}

// Allocation Repository Implementation

type allocationRepository struct {
	db *sql.DB
}

func (r *allocationRepository) Upsert(ctx context.Context, alloc *domain.EnvelopeAllocation) error {
	query := `INSERT INTO envelope_allocations (budget_id, account_id, category_id, amount, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?)
	          ON CONFLICT(budget_id, account_id, category_id) DO UPDATE SET
	              amount = excluded.amount,
	              updated_at = excluded.updated_at`
	_, err := r.db.ExecContext(ctx, query, alloc.BudgetID, alloc.AccountID, alloc.CategoryID, alloc.Amount, alloc.CreatedAt, alloc.UpdatedAt)
	return err
}

func (r *allocationRepository) Get(ctx context.Context, budgetID, accountID, categoryID string) (*domain.EnvelopeAllocation, error) {
	query := `SELECT budget_id, account_id, category_id, amount, created_at, updated_at FROM envelope_allocations 
	          WHERE budget_id = ? AND account_id = ? AND category_id = ?`
	row := r.db.QueryRowContext(ctx, query, budgetID, accountID, categoryID)

	var alloc domain.EnvelopeAllocation
	err := row.Scan(&alloc.BudgetID, &alloc.AccountID, &alloc.CategoryID, &alloc.Amount, &alloc.CreatedAt, &alloc.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("envelope allocation not found")
		}
		return nil, err
	}
	return &alloc, nil
}

func (r *allocationRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.EnvelopeAllocation, error) {
	query := `SELECT budget_id, account_id, category_id, amount, created_at, updated_at FROM envelope_allocations 
	          WHERE budget_id = ?`
	rows, err := r.db.QueryContext(ctx, query, budgetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.EnvelopeAllocation
	for rows.Next() {
		var alloc domain.EnvelopeAllocation
		err := rows.Scan(&alloc.BudgetID, &alloc.AccountID, &alloc.CategoryID, &alloc.Amount, &alloc.CreatedAt, &alloc.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, &alloc)
	}
	return list, nil
}

func (r *allocationRepository) ListByAccount(ctx context.Context, budgetID, accountID string) ([]*domain.EnvelopeAllocation, error) {
	query := `SELECT budget_id, account_id, category_id, amount, created_at, updated_at FROM envelope_allocations 
	          WHERE budget_id = ? AND account_id = ?`
	rows, err := r.db.QueryContext(ctx, query, budgetID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.EnvelopeAllocation
	for rows.Next() {
		var alloc domain.EnvelopeAllocation
		err := rows.Scan(&alloc.BudgetID, &alloc.AccountID, &alloc.CategoryID, &alloc.Amount, &alloc.CreatedAt, &alloc.UpdatedAt)
		if err != nil {
			return nil, err
		}
		list = append(list, &alloc)
	}
	return list, nil
}

func (r *allocationRepository) Delete(ctx context.Context, budgetID, accountID, categoryID string) error {
	query := `DELETE FROM envelope_allocations WHERE budget_id = ? AND account_id = ? AND category_id = ?`
	_, err := r.db.ExecContext(ctx, query, budgetID, accountID, categoryID)
	return err
}

// Job Repository Implementation

type jobRepository struct {
	db *sql.DB
}

func (r *jobRepository) Create(ctx context.Context, job *domain.Job) error {
	query := `INSERT INTO background_jobs (id, job_type, payload, status, attempts, max_attempts, run_at, error_message, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, job.ID, job.JobType, job.Payload, string(job.Status), job.Attempts, job.MaxAttempts, job.RunAt, job.ErrorMessage, job.CreatedAt, job.UpdatedAt)
	return err
}

func (r *jobRepository) GetNextPending(ctx context.Context) (*domain.Job, error) {
	query := `SELECT id, job_type, payload, status, attempts, max_attempts, run_at, error_message, created_at, updated_at 
	          FROM background_jobs 
	          WHERE status = 'pending' AND run_at <= ? 
	          ORDER BY run_at ASC, created_at ASC 
	          LIMIT 1`
	row := r.db.QueryRowContext(ctx, query, time.Now())

	var dbJob db.BackgroundJob
	err := row.Scan(&dbJob.ID, &dbJob.JobType, &dbJob.Payload, &dbJob.Status, &dbJob.Attempts, &dbJob.MaxAttempts, &dbJob.RunAt, &dbJob.ErrorMessage, &dbJob.CreatedAt, &dbJob.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("no pending jobs found")
		}
		return nil, err
	}
	var job domain.Job
	if err := dbJobMapper.BackgroundJobToJob(ctx, &dbJob, &job); err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *jobRepository) UpdateStatus(ctx context.Context, id string, status domain.JobStatus, attempts int, runAt time.Time, errMsg *string) error {
	query := `UPDATE background_jobs 
	          SET status = ?, attempts = ?, run_at = ?, error_message = ?, updated_at = ? 
	          WHERE id = ?`
	var errMsgVal any = nil
	if errMsg != nil {
		errMsgVal = *errMsg
	}
	_, err := r.db.ExecContext(ctx, query, string(status), attempts, runAt, errMsgVal, time.Now(), id)
	return err
}

func (r *jobRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM background_jobs WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
