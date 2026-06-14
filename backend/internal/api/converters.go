package api

import (
	"context"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

// Mappers is a container for all application mappers.
type Mappers struct {
	txMapper TransactionMapper
}

// InitMappers creates and returns an initialized Mappers instance.
func InitMappers() *Mappers {
	mappers := NewMappers()
	mappers.Add("TimestampConverter", &TimestampConverter{})
	tx, err := mappers.Get("budgeting_system/internal/api.TransactionMapper")
	if err != nil {
		panic(err)
	}
	return &Mappers{
		txMapper: tx.(TransactionMapper),
	}
}

// Transaction returns the TransactionMapper.
func (m *Mappers) Transaction() TransactionMapper {
	return m.txMapper
}

// TimestampConverter converts between *timestamppb.Timestamp and time.Time / *time.Time.
type TimestampConverter struct{}

// TimestampToTime converts *timestamppb.Timestamp to *time.Time.
func (c *TimestampConverter) TimestampToTime(ctx context.Context, source *timestamppb.Timestamp) (*time.Time, error) {
	if source == nil {
		return nil, nil
	}
	t := source.AsTime()
	return &t, nil
}
