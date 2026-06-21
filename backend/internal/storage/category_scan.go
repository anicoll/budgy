package storage

import (
	"context"
	"database/sql"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/storage/db"
)

const categorySelectCols = `id, user_id, parent_id, name, type, color, icon, sort_order, archived, system, basiq_subclass_code, anzsic_class_code, created_at, updated_at`

const accountSelectCols = `id, user_id, name, type, balance, created_at, updated_at, class, account_no, available_funds, product, institution_id, connection_id, last_updated`

func scanCategoryRow(row interface {
	Scan(dest ...any) error
}) (*domain.Category, error) {
	var dbC db.Category
	if err := row.Scan(
		&dbC.ID, &dbC.UserID, &dbC.ParentID, &dbC.Name, &dbC.Type, &dbC.Color, &dbC.Icon,
		&dbC.SortOrder, &dbC.Archived, &dbC.System, &dbC.BasiqSubclassCode, &dbC.AnzsicClassCode,
		&dbC.CreatedAt, &dbC.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return dbCategoryToDomain(&dbC), nil
}

func scanBudgetCategoryRow(row interface {
	Scan(dest ...any) error
}) (*domain.BudgetCategory, error) {
	var dbC db.Category
	var budgeted, balance, targetLimit int64
	var freq string
	if err := row.Scan(
		&dbC.ID, &dbC.UserID, &dbC.ParentID, &dbC.Name, &dbC.Type, &dbC.Color, &dbC.Icon,
		&dbC.SortOrder, &dbC.Archived, &dbC.System, &dbC.BasiqSubclassCode, &dbC.AnzsicClassCode,
		&dbC.CreatedAt, &dbC.UpdatedAt,
		&budgeted, &balance, &targetLimit, &freq,
	); err != nil {
		return nil, err
	}
	c := dbCategoryToDomain(&dbC)
	bf := domain.BudgetFrequency(freq)
	if bf == "" {
		bf = domain.FrequencyMonthly
	}
	return &domain.BudgetCategory{
		Category:          *c,
		Budgeted:          budgeted,
		Balance:           balance,
		TargetLimit:       targetLimit,
		BudgetedFrequency: bf,
	}, nil
}

func dbCategoryToDomain(dbC *db.Category) *domain.Category {
	c := &domain.Category{
		ID:        dbC.ID,
		UserID:    dbC.UserID,
		Name:      dbC.Name,
		Type:      domain.CategoryType(dbC.Type),
		Color:     dbC.Color,
		SortOrder: int(dbC.SortOrder),
		Archived:  dbC.Archived != 0,
		System:    dbC.System != 0,
		CreatedAt: dbC.CreatedAt,
		UpdatedAt: dbC.UpdatedAt,
	}
	if dbC.ParentID.Valid {
		c.ParentID = dbC.ParentID.String
	}
	if dbC.Icon.Valid {
		c.Icon = dbC.Icon.String
	}
	if dbC.BasiqSubclassCode.Valid {
		c.BasiqSubClassCode = dbC.BasiqSubclassCode.String
	}
	if dbC.AnzsicClassCode.Valid {
		c.AnzsicClassCode = dbC.AnzsicClassCode.String
	}
	return c
}

func scanAccountRow(_ context.Context, row interface {
	Scan(dest ...any) error
}) (*domain.Account, error) {
	var dbAcc db.Account
	if err := row.Scan(
		&dbAcc.ID, &dbAcc.UserID, &dbAcc.Name, &dbAcc.Type, &dbAcc.Balance,
		&dbAcc.CreatedAt, &dbAcc.UpdatedAt, &dbAcc.Class, &dbAcc.AccountNo,
		&dbAcc.AvailableFunds, &dbAcc.Product, &dbAcc.InstitutionID, &dbAcc.ConnectionID, &dbAcc.LastUpdated,
	); err != nil {
		return nil, err
	}
	return dbAccountToDomain(&dbAcc), nil
}

func dbAccountToDomain(dbAcc *db.Account) *domain.Account {
	acc := &domain.Account{
		ID:        dbAcc.ID,
		UserID:    dbAcc.UserID,
		Name:      dbAcc.Name,
		Type:      domain.AccountType(dbAcc.Type),
		Balance:   dbAcc.Balance,
		CreatedAt: dbAcc.CreatedAt,
		UpdatedAt: dbAcc.UpdatedAt,
	}
	if dbAcc.Class.Valid {
		acc.Class = dbAcc.Class.String
	}
	if dbAcc.AccountNo.Valid {
		acc.AccountNo = dbAcc.AccountNo.String
	}
	if dbAcc.AvailableFunds.Valid {
		v := dbAcc.AvailableFunds.Int64
		acc.AvailableFunds = &v
	}
	if dbAcc.Product.Valid {
		acc.Product = dbAcc.Product.String
	}
	if dbAcc.InstitutionID.Valid {
		acc.InstitutionID = dbAcc.InstitutionID.String
	}
	if dbAcc.ConnectionID.Valid {
		acc.ConnectionID = dbAcc.ConnectionID.String
	}
	if dbAcc.LastUpdated.Valid {
		t := dbAcc.LastUpdated.Time
		acc.LastUpdated = &t
	}
	return acc
}

func scanAccounts(ctx context.Context, rows *sql.Rows) ([]*domain.Account, error) {
	var list []*domain.Account
	for rows.Next() {
		acc, err := scanAccountRow(ctx, rows)
		if err != nil {
			return nil, err
		}
		list = append(list, acc)
	}
	return list, rows.Err()
}

func scanCategories(rows *sql.Rows) ([]*domain.Category, error) {
	var list []*domain.Category
	for rows.Next() {
		c, err := scanCategoryRow(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}
