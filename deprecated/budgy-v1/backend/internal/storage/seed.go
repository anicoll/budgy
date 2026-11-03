package storage

import (
	"context"

	"budgeting_system/internal/domain/categoryseed"
)

// SeedCategoriesForUser implements service.CategorySeeder.
func (s *SQLiteStorage) SeedCategoriesForUser(ctx context.Context, userID string) error {
	return categoryseed.SeedCategoriesForUser(ctx, s.db, userID)
}
