package api

import (
	"net/http"
	"os"
	"time"

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

// parseJWT validates a raw token string and populates claims.
func parseJWT(tokenStr string, claims *Claims) (*jwt.Token, error) {
	return jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (any, error) {
		return jwtSecretKey, nil
	})
}

// AuthTokenCookieName is the session cookie set on login/register.
const AuthTokenCookieName = "token"

// NewAuthTokenCookie builds the HTTP-only session cookie for a user.
func NewAuthTokenCookie(userID string) (*http.Cookie, error) {
	token, err := GenerateJWT(userID)
	if err != nil {
		return nil, err
	}
	return &http.Cookie{
		Name:     AuthTokenCookieName,
		Value:    token,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	}, nil
}

// ClearAuthTokenCookie returns a cookie that removes the session.
func ClearAuthTokenCookie() *http.Cookie {
	return &http.Cookie{
		Name:     AuthTokenCookieName,
		Value:    "",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	}
}
