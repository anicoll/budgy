package api

import (
	"context"
)

type contextKey string

const (
	userIDContextKey contextKey = "userID"
)

// getUserID extracts the user ID from context.
func getUserID(ctx context.Context) string {
	if val := ctx.Value(userIDContextKey); val != nil {
		if id, ok := val.(string); ok {
			return id
		}
	}
	return ""
}
