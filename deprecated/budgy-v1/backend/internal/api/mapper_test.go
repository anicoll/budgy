package api

import (
	"context"
	"testing"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"budgeting_system/internal/domain"
	budgyv1 "budgeting_system/internal/gen/budgy/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTransactionMapper_FullUpdate(t *testing.T) {
	ctx := context.Background()
	mappers := InitMappers()
	mapper := mappers.Transaction()

	now := time.Now().UTC().Truncate(time.Second)
	postDate := now.Add(-24 * time.Hour)

	accountID := "acc-123"
	categoryID := "cat-456"
	var amount int64 = 5000
	description := "Coffee"
	direction := "debit"
	status := "posted"
	class := "food"
	subClass := "cafe"
	rawDesc := "RAW COFFEE SHOP"
	merchantName := "Blue Bottle"

	req := &budgyv1.UpdateTransactionRequest{
		AccountId:      &accountID,
		CategoryId:     &categoryID,
		Amount:         &amount,
		Description:    &description,
		Date:           timestamppb.New(now),
		Direction:      &direction,
		Status:         &status,
		Class:          &class,
		PostDate:       timestamppb.New(postDate),
		SubClass:       &subClass,
		RawDescription: &rawDesc,
		MerchantName:   &merchantName,
	}

	dest := &domain.Transaction{}
	require.NoError(t, mapper.UpdateTransactionRequestToTransaction(ctx, req, dest))

	assert.Equal(t, accountID, dest.AccountID)
	assert.Equal(t, categoryID, dest.CategoryID)
	assert.Equal(t, amount, dest.Amount)
	assert.Equal(t, description, dest.Description)
	assert.Equal(t, now, dest.Date)
	assert.Equal(t, direction, dest.Direction)
	assert.Equal(t, status, dest.Status)
	assert.Equal(t, class, dest.Class)
	require.NotNil(t, dest.PostDate)
	assert.Equal(t, postDate, *dest.PostDate)
	assert.Equal(t, subClass, dest.SubClass)
	assert.Equal(t, rawDesc, dest.RawDescription)
	assert.Equal(t, merchantName, dest.MerchantName)
}

func TestTransactionMapper_PartialUpdate(t *testing.T) {
	ctx := context.Background()
	mappers := InitMappers()
	mapper := mappers.Transaction()

	description := "Updated description"
	req := &budgyv1.UpdateTransactionRequest{
		Description: &description,
	}

	// Pre-populate dest with existing values that should NOT be overwritten
	dest := &domain.Transaction{
		AccountID:  "existing-acc",
		CategoryID: "existing-cat",
		Amount:     1000,
	}

	require.NoError(t, mapper.UpdateTransactionRequestToTransaction(ctx, req, dest))

	// Only description should change
	assert.Equal(t, description, dest.Description)
	// Existing values preserved
	assert.Equal(t, "existing-acc", dest.AccountID)
	assert.Equal(t, "existing-cat", dest.CategoryID)
	assert.Equal(t, int64(1000), dest.Amount)
}

func TestTransactionMapper_NilDates(t *testing.T) {
	ctx := context.Background()
	mappers := InitMappers()
	mapper := mappers.Transaction()

	// No Date or PostDate set
	desc := "test"
	req := &budgyv1.UpdateTransactionRequest{
		Description: &desc,
	}

	dest := &domain.Transaction{}
	require.NoError(t, mapper.UpdateTransactionRequestToTransaction(ctx, req, dest))

	assert.True(t, dest.Date.IsZero(), "Date should remain zero when not provided")
	assert.Nil(t, dest.PostDate, "PostDate should remain nil when not provided")
}

func TestTimestampConverter_NilInput(t *testing.T) {
	ctx := context.Background()
	conv := &TimestampConverter{}

	tp, err := conv.TimestampToTime(ctx, nil)
	require.NoError(t, err)
	assert.Nil(t, tp)
}

func TestTimestampConverter_ValidInput(t *testing.T) {
	ctx := context.Background()
	conv := &TimestampConverter{}

	now := time.Now().UTC().Truncate(time.Second)
	ts := timestamppb.New(now)

	tp, err := conv.TimestampToTime(ctx, ts)
	require.NoError(t, err)
	require.NotNil(t, tp)
	assert.Equal(t, now, *tp)
}

func TestUserMapper(t *testing.T) {
	ctx := context.Background()
	mappers := InitMappers()

	now := time.Now().UTC().Truncate(time.Second)
	u := &domain.User{
		ID:          "u-1",
		Email:       "test@example.com",
		FirstName:   "John",
		LastName:    "Doe",
		BasiqUserID: "bas-123",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	p := mappers.User(ctx, u)
	require.NotNil(t, p)
	assert.Equal(t, u.ID, p.Id)
	assert.Equal(t, u.Email, p.Email)
	assert.Equal(t, u.FirstName, p.FirstName)
	assert.Equal(t, u.LastName, p.LastName)
	assert.Equal(t, u.BasiqUserID, p.BasiqUserId)
	assert.Equal(t, u.CreatedAt, p.CreatedAt.AsTime())
	assert.Equal(t, u.UpdatedAt, p.UpdatedAt.AsTime())
}

func TestBudgetMapper(t *testing.T) {
	ctx := context.Background()
	mappers := InitMappers()

	now := time.Now().UTC().Truncate(time.Second)
	b := &domain.Budget{
		ID:        "b-1",
		UserID:    "u-1",
		Name:      "Budget Name",
		Method:    domain.MethodEnvelope,
		Currency:  "AUD",
		CreatedAt: now,
		UpdatedAt: now,
	}

	p := mappers.Budget(ctx, b)
	require.NotNil(t, p)
	assert.Equal(t, b.ID, p.Id)
	assert.Equal(t, b.UserID, p.UserId)
	assert.Equal(t, b.Name, p.Name)
	assert.Equal(t, budgyv1.BudgetMethod_BUDGET_METHOD_ENVELOPE, p.Method)
	assert.Equal(t, b.Currency, p.Currency)
	assert.Equal(t, b.CreatedAt, p.CreatedAt.AsTime())
	assert.Equal(t, b.UpdatedAt, p.UpdatedAt.AsTime())
}

func TestAccountMapper(t *testing.T) {
	ctx := context.Background()
	mappers := InitMappers()

	now := time.Now().UTC().Truncate(time.Second)
	funds := int64(1000)
	a := &domain.Account{
		ID:             "a-1",
		UserID:         "user-1",
		Name:           "Savings",
		Type:           domain.AccountSavings,
		Balance:        5000,
		CreatedAt:      now,
		UpdatedAt:      now,
		Class:          "asset",
		AccountNo:      "123-456",
		AvailableFunds: &funds,
		Product:        "SuperSaver",
		InstitutionID:  "inst-1",
		ConnectionID:   "conn-1",
		LastUpdated:    &now,
	}

	p := mappers.Account(ctx, a)
	require.NotNil(t, p)
	assert.Equal(t, a.ID, p.Id)
	assert.Equal(t, a.UserID, p.UserId)
	assert.Equal(t, a.Name, p.Name)
	assert.Equal(t, budgyv1.AccountType_ACCOUNT_TYPE_SAVINGS, p.Type)
	assert.Equal(t, a.Balance, p.Balance)
	assert.Equal(t, a.Class, p.Class)
	assert.Equal(t, a.AccountNo, p.AccountNo)
	assert.Equal(t, *a.AvailableFunds, *p.AvailableFunds)
	assert.Equal(t, a.Product, p.Product)
	assert.Equal(t, a.InstitutionID, p.InstitutionId)
	assert.Equal(t, a.ConnectionID, p.ConnectionId)
	assert.Equal(t, *a.LastUpdated, p.LastUpdated.AsTime())
	assert.Equal(t, a.CreatedAt, p.CreatedAt.AsTime())
	assert.Equal(t, a.UpdatedAt, p.UpdatedAt.AsTime())
}

func TestCategoryMapper(t *testing.T) {
	ctx := context.Background()
	mappers := InitMappers()

	now := time.Now().UTC().Truncate(time.Second)
	c := &domain.Category{
		ID:        "c-1",
		UserID:    "user-1",
		Name:      "Groceries",
		Type:      domain.CategoryExpense,
		Color:     "#34d399",
		SortOrder: 1,
		CreatedAt: now,
		UpdatedAt: now,
	}

	p := mappers.Category(ctx, c)
	require.NotNil(t, p)
	assert.Equal(t, c.ID, p.Id)
	assert.Equal(t, c.UserID, p.UserId)
	assert.Equal(t, c.Name, p.Name)
	assert.Equal(t, budgyv1.CategoryType_CATEGORY_TYPE_EXPENSE, p.Type)
	assert.Equal(t, c.CreatedAt, p.CreatedAt.AsTime())
	assert.Equal(t, c.UpdatedAt, p.UpdatedAt.AsTime())
}

func TestTransactionProtoMapper(t *testing.T) {
	ctx := context.Background()
	mappers := InitMappers()

	now := time.Now().UTC().Truncate(time.Second)
	tObj := &domain.Transaction{
		ID:                 "t-1",
		BudgetID:           "b-1",
		AccountID:          "a-1",
		CategoryID:         "c-basiq",
		CustomerCategoryID: "c-user",
		Amount:             -50,
		Description:        "Woolworths",
		Date:               now,
		CreatedAt:          now,
		UpdatedAt:          now,
		Direction:          "debit",
		Status:             "cleared",
		Class:              "food",
		PostDate:           &now,
		SubClass:           "supermarket",
		RawDescription:     "WOOLWORTHS METRO",
		MerchantName:       "Woolworths",
		MerchantWebsite:    "woolworths.com.au",
		MerchantLogoURL:    "logo.png",
		LocationAddress:    "Sydney",
		LocationLat:        "-33.86",
		LocationLng:        "151.20",
		CategoryCode:       "123",
		CategoryTitle:      "Groceries",
	}

	p := mappers.TransactionProto(ctx, tObj)
	require.NotNil(t, p)
	assert.Equal(t, tObj.ID, p.Id)
	assert.Equal(t, tObj.BudgetID, p.BudgetId)
	assert.Equal(t, tObj.AccountID, p.AccountId)
	assert.Equal(t, "c-user", p.CategoryId)
	assert.Equal(t, "c-basiq", p.BasiqCategoryId)
	assert.Equal(t, "c-user", p.CustomerCategoryId)
	assert.Equal(t, tObj.Amount, p.Amount)
	assert.Equal(t, tObj.Description, p.Description)
	assert.Equal(t, tObj.Date, p.Date.AsTime())
	assert.Equal(t, tObj.CreatedAt, p.CreatedAt.AsTime())
	assert.Equal(t, tObj.UpdatedAt, p.UpdatedAt.AsTime())
	assert.Equal(t, tObj.Direction, p.Direction)
	assert.Equal(t, tObj.Status, p.Status)
	assert.Equal(t, tObj.Class, p.Class)
	assert.Equal(t, *tObj.PostDate, p.PostDate.AsTime())
	assert.Equal(t, tObj.SubClass, p.SubClass)
	assert.Equal(t, tObj.RawDescription, p.RawDescription)
	assert.Equal(t, tObj.MerchantName, p.MerchantName)
	assert.Equal(t, tObj.MerchantWebsite, p.MerchantWebsite)
	assert.Equal(t, tObj.MerchantLogoURL, p.MerchantLogoUrl)
	assert.Equal(t, tObj.LocationAddress, p.LocationAddress)
	assert.Equal(t, tObj.LocationLat, p.LocationLat)
	assert.Equal(t, tObj.LocationLng, p.LocationLng)
	assert.Equal(t, tObj.CategoryCode, p.CategoryCode)
	assert.Equal(t, tObj.CategoryTitle, p.CategoryTitle)
}
