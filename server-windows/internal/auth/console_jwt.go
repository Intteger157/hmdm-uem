package auth

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const defaultJWTValiditySeconds = 86400

// ConsoleJWTSubject carries the two fields Java TokenProvider.createToken reads from
// the users table. Java JWTFilter resolves the operator by subject (login) and then
// compares the "token" claim to users.authtoken — it does not read userId or role
// from the JWT payload.
type ConsoleJWTSubject struct {
	Login     string
	AuthToken string
}

// MintConsoleJWT issues an HS512 token compatible with the Java TokenProvider.
func MintConsoleJWT(secret, login, authToken string, rememberMe bool) (string, error) {
	return MintConsoleJWTForUser(secret, ConsoleJWTSubject{
		Login:     login,
		AuthToken: authToken,
	}, rememberMe)
}

// MintConsoleJWTForUser mirrors com.hmdm.security.jwt.TokenProvider#createToken.
func MintConsoleJWTForUser(secret string, subject ConsoleJWTSubject, rememberMe bool) (string, error) {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return "", fmt.Errorf("JWT secret is not configured")
	}

	login := strings.TrimSpace(subject.Login)
	if login == "" {
		return "", fmt.Errorf("login is required")
	}

	validity := time.Duration(jwtValiditySeconds(rememberMe)) * time.Second
	expiresAt := time.Now().UTC().Add(validity)

	claims := jwt.MapClaims{
		"sub":   login,
		"token": strings.TrimSpace(subject.AuthToken),
		"exp":   expiresAt.Unix(),
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

func randomIndex(limit int) (int, error) {
	if limit <= 0 {
		return 0, fmt.Errorf("invalid random limit")
	}
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return 0, err
	}
	return int(binary.BigEndian.Uint64(buf[:]) % uint64(limit)), nil
}
