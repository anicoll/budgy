package api

import (
	"budgeting_system/internal/mappings"
	"context"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

// Mappers is a container for all application mappers.
type Mappers struct {
	txMapper mappings.TransactionMapper
}

// InitMappers creates and returns an initialized Mappers instance.
func InitMappers() *Mappers {
	mappers := mappings.NewMappers()
	mappers.Add("TimestampConverter", &TimestampConverter{})
	tx, err := mappers.Get("budgeting_system/internal/mappings.TransactionMapper")
	if err != nil {
		panic(err)
	}
	return new(Mappers{
		txMapper: tx.(mappings.TransactionMapper),
	})
}

// Transaction returns the TransactionMapper.
func (m *Mappers) Transaction() mappings.TransactionMapper {
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
