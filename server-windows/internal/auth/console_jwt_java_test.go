package auth_test

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hmdm/server-windows/internal/auth"
)

// Simulates com.hmdm.security.jwt.JWTFilter#doFilter auth-token validation.
func TestSSOJWTMatchesJavaJWTFilterExpectations(t *testing.T) {
	const secret = "shared-console-secret"
	const login = "operator@example.com"
	const authToken = "Ab12Cd34Ef56Gh78Ij90"

	signed, err := auth.MintConsoleJWTForUser(secret, auth.ConsoleJWTSubject{
		Login:     login,
		AuthToken: authToken,
	}, false)
	if err != nil {
		t.Fatalf("MintConsoleJWTForUser() error = %v", err)
	}

	claims := jwt.MapClaims{}
	_, err = jwt.ParseWithClaims(signed, claims, func(*jwt.Token) (any, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS512.Alg()}))
	if err != nil {
		t.Fatalf("parse token like Java TokenProvider.validateToken: %v", err)
	}

	if claims["sub"] != login {
		t.Fatalf("subject = %v, want %q", claims["sub"], login)
	}
	if claims["token"] != authToken {
		t.Fatalf("token claim = %v, want %q", claims["token"], authToken)
	}
}
