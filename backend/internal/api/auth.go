package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"time"

	"budgeting_system/internal/domain"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type contextKey string

const userIDContextKey contextKey = "userID"

var jwtSecretKey = []byte("default-dev-secret-key-change-this-in-prod")

func init() {
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		jwtSecretKey = []byte(secret)
	}
}

// Claims defines the JWT token structure
type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

// HashPassword hashes a plain text password
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPasswordHash compares a password hash with a plain text password
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateJWT creates a signed token for a user
func GenerateJWT(userID string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecretKey)
}

// getUserID extracts the user ID from the request context
func getUserID(r *http.Request) string {
	if val := r.Context().Value(userIDContextKey); val != nil {
		if id, ok := val.(string); ok {
			return id
		}
	}
	return ""
}

// withAuth is a middleware wrapper to authenticate requests via JWT cookie
func (s *APIServer) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("token")
		if err != nil {
			if errors.Is(err, http.ErrNoCookie) {
				s.respondError(w, http.StatusUnauthorized, "unauthorized: missing token")
				return
			}
			s.respondError(w, http.StatusBadRequest, "unauthorized: bad request")
			return
		}

		tokenStr := cookie.Value
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecretKey, nil
		})

		if err != nil || !token.Valid {
			s.respondError(w, http.StatusUnauthorized, "unauthorized: invalid token")
			return
		}

		ctx := context.WithValue(r.Context(), userIDContextKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// handleSecure is a helper to register protected routes
func (s *APIServer) handleSecure(mux *http.ServeMux, pattern string, handler http.HandlerFunc) {
	mux.HandleFunc(pattern, s.withAuth(handler))
}

// Auth Handlers

func (s *APIServer) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req struct {
		Email     string `json:"email"`
		Password  string `json:"password"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Email == "" || len(req.Password) < 6 || req.FirstName == "" || req.LastName == "" {
		s.respondError(w, http.StatusBadRequest, "missing fields or password too short (min 6 chars)")
		return
	}

	// Check if user already exists
	existing, err := s.users.GetByEmail(r.Context(), req.Email)
	if err == nil && existing != nil {
		s.respondError(w, http.StatusConflict, "user with this email already exists")
		return
	}

	passwordHash, err := HashPassword(req.Password)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user := &domain.User{
		ID:           generateID(),
		Email:        req.Email,
		PasswordHash: passwordHash,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.users.Create(r.Context(), user); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to create user: "+err.Error())
		return
	}

	s.respondJSON(w, http.StatusCreated, user)
}

func (s *APIServer) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := s.users.GetByEmail(r.Context(), req.Email)
	if err != nil || !CheckPasswordHash(req.Password, user.PasswordHash) {
		s.respondError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := GenerateJWT(user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})

	s.respondJSON(w, http.StatusOK, user)
}

func (s *APIServer) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})

	s.respondJSON(w, http.StatusOK, map[string]string{"message": "logged out successfully"})
}

func (s *APIServer) handleMe(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user, err := s.users.GetByID(r.Context(), userID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "user not found")
		return
	}

	s.respondJSON(w, http.StatusOK, user)
}
