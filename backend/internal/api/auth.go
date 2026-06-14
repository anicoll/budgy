package api

import (
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
	return jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecretKey, nil
	})
}
