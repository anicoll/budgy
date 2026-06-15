package mappings

import (
	"context"
	"database/sql"
	"time"
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
