package mappings

import (
	"context"
	"database/sql"
	"time"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/storage/db"
)

// NullStringConverter converts sql.NullString to string.
type NullStringConverter struct{}

func (c *NullStringConverter) NullStringToString(ctx context.Context, source *sql.NullString) (string, bool, error) {
	if source == nil || !source.Valid {
		return "", true, nil
	}
	return source.String, false, nil
}

// NullTimeConverter converts sql.NullTime to *time.Time.
type NullTimeConverter struct{}

func (c *NullTimeConverter) NullTimeToTimePtr(ctx context.Context, source *sql.NullTime) (*time.Time, error) {
	if source == nil || !source.Valid {
		return nil, nil
	}
	t := source.Time
	return &t, nil
}

// NullInt64Converter converts sql.NullInt64 to *int64.
type NullInt64Converter struct{}

func (c *NullInt64Converter) NullInt64ToInt64Ptr(ctx context.Context, source *sql.NullInt64) (*int64, error) {
	if source == nil || !source.Valid {
		return nil, nil
	}
	val := source.Int64
	return &val, nil
}

// DBJobMapperHelperImpl implements post-mapping logic for DBJobMapper.
type DBJobMapperHelperImpl struct{}

func (h *DBJobMapperHelperImpl) BackgroundJobToJob(ctx context.Context, source *db.BackgroundJob, dest *domain.Job) error {
	if source.ErrorMessage.Valid {
		dest.ErrorMessage = &source.ErrorMessage.String
	} else {
		dest.ErrorMessage = nil
	}
	return nil
}
