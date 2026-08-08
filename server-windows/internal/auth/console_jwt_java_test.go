package auth_test

import (
	"encoding/base64"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hmdm/server-windows/internal/auth"
)

// Simulates com.hmdm.security.jwt.JWTFilter#doFilter auth-token validation.
func TestSSOJWTMatchesJavaJWTFilterExpectations(t *testing.T) {
	const secret = "20c68f0d9185b1d18cf6add1e8b491fd89529a44"
	const login = "operator@example.com"
	const authToken = "Ab12Cd34Ef56Gh78Ij90"

	signed, err := auth.MintConsoleJWTForUser(secret, auth.ConsoleJWTSubject{
		Login:     login,
		AuthToken: authToken,
	}, false)
	if err != nil {
		t.Fatalf("MintConsoleJWTForUser() error = %v", err)
	}

	key, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		t.Fatalf("decode secret: %v", err)
	}

	claims := jwt.MapClaims{}
	_, err = jwt.ParseWithClaims(signed, claims, func(*jwt.Token) (any, error) {
		return key, nil
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
