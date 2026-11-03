package categoryseed

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

// SeedCategoriesForUser inserts the default taxonomy for one user when none exist.
func SeedCategoriesForUser(ctx context.Context, db *sql.DB, userID string) error {
	var count int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM categories WHERE user_id = ? AND system = 1`, userID,
	).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now()
	idMap := make(map[string]string)
	nodes := Tree()

	for _, n := range nodes {
		idMap[n.SeedID] = uuid.New().String()
	}

	for _, n := range nodes {
		var parentID any
		if n.ParentSeedID != "" {
			parentID = idMap[n.ParentSeedID]
		}
		system := 0
		if n.System {
			system = 1
		}
		var basiqCode any
		if n.BasiqSubClassCode != "" {
			basiqCode = n.BasiqSubClassCode
		}
		var anzsic any
		if n.AnzsicClassCode != "" {
			anzsic = n.AnzsicClassCode
		}
		_, err := db.ExecContext(ctx, `
			INSERT INTO categories (
				id, user_id, parent_id, name, type, color, icon, sort_order, archived, system,
				basiq_subclass_code, anzsic_class_code, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?)`,
			idMap[n.SeedID], userID, parentID, n.Name, n.Type, n.Color, n.SortOrder, system,
			basiqCode, anzsic, now, now,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// ApplyForAllUsers seeds categories for every user missing system categories.
func ApplyForAllUsers(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `SELECT id FROM users`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		userIDs = append(userIDs, id)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, userID := range userIDs {
		if err := SeedCategoriesForUser(ctx, db, userID); err != nil {
			return err
		}
	}
	return nil
}

// ErrNoUsers is returned when seeding is attempted with no users in the database.
var ErrNoUsers = errors.New("no users to seed categories for")
