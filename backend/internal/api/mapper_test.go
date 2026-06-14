package api

import (
	"context"
	"testing"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	budgyv1 "budgeting_system/internal/gen/budgy/v1"
	"budgeting_system/internal/domain"

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
