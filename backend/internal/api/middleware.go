package api

import (
	"context"
	"errors"
	"net/http"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/service"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	userIDContextKey contextKey = "userID"
	budgetContextKey contextKey = "verifiedBudget"
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

// getVerifiedBudget extracts the pre-verified budget from context.
func getVerifiedBudget(ctx context.Context) *domain.Budget {
	if val := ctx.Value(budgetContextKey); val != nil {
		if b, ok := val.(*domain.Budget); ok {
			return b
		}
	}
	return nil
}

// withAuth is a middleware wrapper to authenticate requests via JWT cookie.
func (s *APIServer) withAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("token")
		if err != nil {
			if errors.Is(err, http.ErrNoCookie) {
				respondError(w, http.StatusUnauthorized, "unauthorized: missing token")
				return
			}
			respondError(w, http.StatusBadRequest, "unauthorized: bad request")
			return
		}

		tokenStr := cookie.Value
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecretKey, nil
		})

		if err != nil || !token.Valid {
			respondError(w, http.StatusUnauthorized, "unauthorized: invalid token")
			return
		}

		ctx := context.WithValue(r.Context(), userIDContextKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// budgetOwnerMiddleware verifies that the current user owns the budget specified in path {id}.
func (s *APIServer) budgetOwnerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		budgetID := r.PathValue("id")
		if budgetID == "" {
			respondError(w, http.StatusBadRequest, "missing budget id")
			return
		}

		b, err := s.budgets.GetByID(r.Context(), budgetID)
		if err != nil {
			if errors.Is(err, service.ErrNotFound) {
				respondError(w, http.StatusNotFound, "budget not found")
				return
			}
			respondError(w, http.StatusInternalServerError, "failed to check budget ownership")
			return
		}

		userID := getUserID(r.Context())
		if b.UserID != userID {
			respondError(w, http.StatusForbidden, "forbidden")
			return
		}

		ctx := context.WithValue(r.Context(), budgetContextKey, b)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// handleSecure binds authentication middleware.
func (s *APIServer) handleSecure(mux *http.ServeMux, pattern string, handler http.HandlerFunc) {
	mux.Handle(pattern, s.withAuth(handler))
}

// handleBudgetSecure binds authentication and budget ownership middlewares.
func (s *APIServer) handleBudgetSecure(mux *http.ServeMux, pattern string, handler http.HandlerFunc) {
	mux.Handle(pattern, s.withAuth(s.budgetOwnerMiddleware(handler)))
}
