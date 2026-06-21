package storage

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"time"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/domain/categoryseed"
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
	if err := goose.Up(db, "migrations"); err != nil {
		return err
	}
	return categoryseed.ApplyForAllUsers(context.Background(), db)
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

func (s *SQLiteStorage) BudgetAccounts() domain.BudgetAccountRepository {
	return &budgetAccountRepository{db: s.db}
}

func (s *SQLiteStorage) BudgetCategoryLines() domain.BudgetCategoryLineRepository {
	return &budgetCategoryLineRepository{db: s.db}
}

func (r *budgetRepository) Create(ctx context.Context, b *domain.Budget) error {
	period := string(b.Period)
	if period == "" {
		period = string(domain.PeriodMonthly)
	}
	startDate := b.StartDate
	if startDate == "" {
		startDate = time.Now().Format("2006-01-02")
	}
	query := `INSERT INTO budgets (id, user_id, name, method, currency, period, start_date, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, b.ID, b.UserID, b.Name, string(b.Method), b.Currency, period, startDate, b.CreatedAt, b.UpdatedAt)
	return err
}

func (r *budgetRepository) GetByID(ctx context.Context, id string) (*domain.Budget, error) {
	query := `SELECT id, user_id, name, method, currency, period, start_date, created_at, updated_at FROM budgets WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)
	return scanBudget(row)
}

func (r *budgetRepository) List(ctx context.Context, userID string) ([]*domain.Budget, error) {
	query := `SELECT id, user_id, name, method, currency, period, start_date, created_at, updated_at FROM budgets WHERE user_id = ? ORDER BY created_at`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Budget
	for rows.Next() {
		b, err := scanBudget(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, rows.Err()
}

func (r *budgetRepository) Update(ctx context.Context, b *domain.Budget) error {
	period := string(b.Period)
	if period == "" {
		period = string(domain.PeriodMonthly)
	}
	startDate := b.StartDate
	if startDate == "" {
		startDate = time.Now().Format("2006-01-02")
	}
	query := `UPDATE budgets SET user_id = ?, name = ?, method = ?, currency = ?, period = ?, start_date = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, b.UserID, b.Name, string(b.Method), b.Currency, period, startDate, b.UpdatedAt, b.ID)
	return err
}

func scanBudget(row interface {
	Scan(dest ...any) error
}) (*domain.Budget, error) {
	var b domain.Budget
	var method, period, startDate string
	err := row.Scan(&b.ID, &b.UserID, &b.Name, &method, &b.Currency, &period, &startDate, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("budget not found")
		}
		return nil, err
	}
	b.Method = domain.BudgetMethod(method)
	b.Period = domain.BudgetPeriod(period)
	if b.Period == "" {
		b.Period = domain.PeriodMonthly
	}
	b.StartDate = startDate
	if b.StartDate == "" {
		b.StartDate = time.Now().Format("2006-01-02")
	}
	return &b, nil
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
	query := `INSERT INTO accounts (id, user_id, name, type, balance, created_at, updated_at, class, account_no, available_funds, product, institution_id, connection_id, last_updated)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, acc.ID, acc.UserID, acc.Name, string(acc.Type), acc.Balance, acc.CreatedAt, acc.UpdatedAt, acc.Class, acc.AccountNo, acc.AvailableFunds, acc.Product, acc.InstitutionID, acc.ConnectionID, acc.LastUpdated)
	return err
}

func (r *accountRepository) GetByID(ctx context.Context, id string) (*domain.Account, error) {
	query := `SELECT ` + accountSelectCols + ` FROM accounts WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)
	acc, err := scanAccountRow(ctx, row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("account not found")
		}
		return nil, err
	}
	return acc, nil
}

func (r *accountRepository) ListByUser(ctx context.Context, userID string) ([]*domain.Account, error) {
	query := `SELECT ` + accountSelectCols + ` FROM accounts WHERE user_id = ?`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAccounts(ctx, rows)
}

func (r *accountRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Account, error) {
	repo := &budgetAccountRepository{db: r.db}
	return repo.ListAccountsByBudget(ctx, budgetID)
}

func (r *accountRepository) UpdateBalance(ctx context.Context, id string, balance int64) error {
	query := `UPDATE accounts SET balance = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, balance, time.Now(), id)
	return err
}

func (r *accountRepository) Update(ctx context.Context, acc *domain.Account) error {
	query := `UPDATE accounts SET user_id = ?, name = ?, type = ?, balance = ?, updated_at = ?, class = ?, account_no = ?, available_funds = ?, product = ?, institution_id = ?, connection_id = ?, last_updated = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, acc.UserID, acc.Name, string(acc.Type), acc.Balance, acc.UpdatedAt, acc.Class, acc.AccountNo, acc.AvailableFunds, acc.Product, acc.InstitutionID, acc.ConnectionID, acc.LastUpdated, acc.ID)
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
	var parentID any
	if c.ParentID != "" {
		parentID = c.ParentID
	}
	archived := 0
	if c.Archived {
		archived = 1
	}
	system := 0
	if c.System {
		system = 1
	}
	var icon, basiqCode, anzsic any
	if c.Icon != "" {
		icon = c.Icon
	}
	if c.BasiqSubClassCode != "" {
		basiqCode = c.BasiqSubClassCode
	}
	if c.AnzsicClassCode != "" {
		anzsic = c.AnzsicClassCode
	}
	query := `INSERT INTO categories (id, user_id, parent_id, name, type, color, icon, sort_order, archived, system, basiq_subclass_code, anzsic_class_code, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, c.ID, c.UserID, parentID, c.Name, string(c.Type), c.Color, icon, c.SortOrder, archived, system, basiqCode, anzsic, c.CreatedAt, c.UpdatedAt)
	return err
}

func (r *categoryRepository) GetByID(ctx context.Context, id string) (*domain.Category, error) {
	query := `SELECT ` + categorySelectCols + ` FROM categories WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)
	c, err := scanCategoryRow(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("category not found")
		}
		return nil, err
	}
	return c, nil
}

func (r *categoryRepository) GetByBasiqSubClassCode(ctx context.Context, userID, code string) (*domain.Category, error) {
	query := `SELECT ` + categorySelectCols + ` FROM categories WHERE user_id = ? AND basiq_subclass_code = ? LIMIT 1`
	row := r.db.QueryRowContext(ctx, query, userID, code)
	c, err := scanCategoryRow(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("category not found")
		}
		return nil, err
	}
	return c, nil
}

func (r *categoryRepository) ListByUser(ctx context.Context, userID string) ([]*domain.Category, error) {
	query := `SELECT ` + categorySelectCols + ` FROM categories WHERE user_id = ? ORDER BY sort_order, name`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCategories(rows)
}

func (r *categoryRepository) Update(ctx context.Context, c *domain.Category) error {
	var parentID any
	if c.ParentID != "" {
		parentID = c.ParentID
	}
	archived := 0
	if c.Archived {
		archived = 1
	}
	system := 0
	if c.System {
		system = 1
	}
	var icon, basiqCode, anzsic any
	if c.Icon != "" {
		icon = c.Icon
	}
	if c.BasiqSubClassCode != "" {
		basiqCode = c.BasiqSubClassCode
	}
	if c.AnzsicClassCode != "" {
		anzsic = c.AnzsicClassCode
	}
	query := `UPDATE categories SET user_id = ?, parent_id = ?, name = ?, type = ?, color = ?, icon = ?, sort_order = ?, archived = ?, system = ?, basiq_subclass_code = ?, anzsic_class_code = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, c.UserID, parentID, c.Name, string(c.Type), c.Color, icon, c.SortOrder, archived, system, basiqCode, anzsic, c.UpdatedAt, c.ID)
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

const txSelectCols = `t.id, t.account_id, t.category_id, t.amount, t.description, t.date, t.created_at, t.updated_at, t.direction, t.status, t.class, t.post_date, t.sub_class, t.raw_description, t.merchant_name, t.merchant_website, t.merchant_logo_url, t.location_address, t.location_lat, t.location_lng, t.category_code, t.category_title`

func (r *transactionRepository) GetByID(ctx context.Context, id string) (*domain.Transaction, error) {
	query := `SELECT ` + txSelectCols + ` FROM transactions t WHERE t.id = ?`
	row := r.db.QueryRowContext(ctx, query, id)
	tx, err := scanTransactionRow(ctx, row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("transaction not found")
		}
		return nil, err
	}
	return tx, nil
}

func (r *transactionRepository) ListByBudget(ctx context.Context, budgetID string) ([]*domain.Transaction, error) {
	query := `SELECT ` + txSelectCols + `
	          FROM transactions t
	          INNER JOIN budget_accounts ba ON ba.account_id = t.account_id
	          WHERE ba.budget_id = ?`
	return r.listQuery(ctx, query, budgetID)
}

func (r *transactionRepository) ListByUser(ctx context.Context, userID string) ([]*domain.Transaction, error) {
	query := `SELECT ` + txSelectCols + `
	          FROM transactions t
	          INNER JOIN accounts a ON a.id = t.account_id
	          WHERE a.user_id = ?`
	return r.listQuery(ctx, query, userID)
}

func (r *transactionRepository) ListByAccount(ctx context.Context, accountID string) ([]*domain.Transaction, error) {
	query := `SELECT ` + txSelectCols + ` FROM transactions t WHERE t.account_id = ?`
	return r.listQuery(ctx, query, accountID)
}

func (r *transactionRepository) ListByCategory(ctx context.Context, categoryID string) ([]*domain.Transaction, error) {
	query := `SELECT ` + txSelectCols + ` FROM transactions t WHERE t.category_id = ?`
	return r.listQuery(ctx, query, categoryID)
}

func scanTransactionRow(ctx context.Context, row interface {
	Scan(dest ...any) error
}) (*domain.Transaction, error) {
	var dbTx db.Transaction
	err := row.Scan(
		&dbTx.ID,
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
	return &tx, nil
}

func (r *transactionRepository) listQuery(ctx context.Context, query string, arg any) ([]*domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Transaction
	for rows.Next() {
		tx, err := scanTransactionRow(ctx, rows)
		if err != nil {
			return nil, err
		}
		list = append(list, tx)
	}
	return list, rows.Err()
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
