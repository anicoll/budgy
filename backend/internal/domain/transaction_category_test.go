package domain

import "testing"

func TestTransaction_EffectiveCategoryID(t *testing.T) {
	t.Run("prefers customer override", func(t *testing.T) {
		tx := &Transaction{CategoryID: "basiq-cat", CustomerCategoryID: "user-cat"}
		if got := tx.EffectiveCategoryID(); got != "user-cat" {
			t.Fatalf("expected user-cat, got %s", got)
		}
	})

	t.Run("falls back to basiq category", func(t *testing.T) {
		tx := &Transaction{CategoryID: "basiq-cat"}
		if got := tx.EffectiveCategoryID(); got != "basiq-cat" {
			t.Fatalf("expected basiq-cat, got %s", got)
		}
	})
}
