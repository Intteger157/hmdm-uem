package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const defaultJWTValiditySeconds = 86400

// MintConsoleJWT issues an HS512 token compatible with the Java TokenProvider.
func MintConsoleJWT(secret, login, authToken string, rememberMe bool) (string, error) {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return "", fmt.Errorf("JWT secret is not configured")
	}
	login = strings.TrimSpace(login)
	if login == "" {
		return "", fmt.Errorf("login is required")
	}

	validity := time.Duration(jwtValiditySeconds(rememberMe)) * time.Second
	now := time.Now().UTC()

	claims := jwt.MapClaims{
		"sub":   login,
		"token": strings.TrimSpace(authToken),
		"exp":   now.Add(validity).Unix(),
		"iat":   now.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", fmt.Errorf("sign console JWT: %w", err)
	}

	return signed, nil
}

func jwtValiditySeconds(rememberMe bool) int64 {
	if rememberMe {
		if raw := strings.TrimSpace(os.Getenv("JWT_VALIDITY_REMEMBER_ME_SECONDS")); raw != "" {
			if value, err := strconv.ParseInt(raw, 10, 64); err == nil && value > 0 {
				return value
			}
		}
		return 2592000
	}

	if raw := strings.TrimSpace(os.Getenv("JWT_VALIDITY_SECONDS")); raw != "" {
		if value, err := strconv.ParseInt(raw, 10, 64); err == nil && value > 0 {
			return value
		}
	}
	return defaultJWTValiditySeconds
}

// GenerateAuthToken creates a rotating console auth token stored in users.authtoken.
func GenerateAuthToken() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate auth token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}
