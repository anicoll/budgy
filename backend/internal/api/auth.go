package api

import (
	"context"
	"net/http"
	"os"
	"time"

	"budgeting_system/internal/service"

	"github.com/golang-jwt/jwt/v5"
)

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

// Auth Handlers using DTOs and wrapper

func (s *APIServer) handleRegister(ctx context.Context, req RegisterRequest) (UserResponse, error) {
	if req.Email == "" || len(req.Password) < 6 || req.FirstName == "" || req.LastName == "" {
		return UserResponse{}, service.ErrBadRequest
	}

	u, err := s.auth.Register(ctx, req.Email, req.Password, req.FirstName, req.LastName)
	if err != nil {
		return UserResponse{}, err
	}

	return ToUserResponse(u), nil
}

func (s *APIServer) handleLogin(ctx context.Context, req LoginRequest) (UserResponse, error) {
	u, err := s.auth.Login(ctx, req.Email, req.Password)
	if err != nil {
		return UserResponse{}, err
	}

	token, err := GenerateJWT(u.ID)
	if err != nil {
		return UserResponse{}, err
	}

	r := RequestFromContext(ctx)
	w := getResponseWriter(ctx)

	if w != nil && r != nil {
		http.SetCookie(w, &http.Cookie{
			Name:     "token",
			Value:    token,
			Expires:  time.Now().Add(24 * time.Hour),
			HttpOnly: true,
			Path:     "/",
			SameSite: http.SameSiteLaxMode,
		})
	}

	return ToUserResponse(u), nil
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

	respondJSON(w, http.StatusOK, map[string]string{"message": "logged out successfully"})
}

func (s *APIServer) handleMe(ctx context.Context, _ struct{}) (UserResponse, error) {
	userID := getUserID(ctx)
	if userID == "" {
		return UserResponse{}, service.ErrUnauthorized
	}

	u, err := s.auth.GetUserByID(ctx, userID)
	if err != nil {
		return UserResponse{}, err
	}

	return ToUserResponse(u), nil
}

// Helper to get ResponseWriter from context if needed (stored by MakeHandler)
func getResponseWriter(ctx context.Context) http.ResponseWriter {
	w, _ := ctx.Value(responseWriterKey).(http.ResponseWriter)
	return w
}
