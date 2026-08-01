package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testJWTSecret = "20c68f0d9185b1d18cf6add1e8b491fd89529a44"

func TestMintConsoleJWTMatchesJavaShape(t *testing.T) {
	token, err := MintConsoleJWT(testJWTSecret, "global.admin", "auth-global", false)
	if err != nil {
		t.Fatalf("MintConsoleJWT() error = %v", err)
	}

	claims := jwt.MapClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (any, error) {
		return []byte(testJWTSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS512.Alg()}))
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	if !parsed.Valid {
		t.Fatal("token is not valid")
	}

	if claims["sub"] != "global.admin" {
		t.Fatalf("sub = %v, want global.admin", claims["sub"])
	}
	if claims["token"] != "auth-global" {
		t.Fatalf("token claim = %v, want auth-global", claims["token"])
	}

	exp, ok := claims["exp"].(float64)
	if !ok {
		t.Fatalf("exp = %T, want float64", claims["exp"])
	}
	if time.Until(time.Unix(int64(exp), 0)) < 23*time.Hour {
		t.Fatalf("expiry too soon: %v", time.Unix(int64(exp), 0))
	}
}

func TestGenerateAuthTokenLength(t *testing.T) {
	token, err := GenerateAuthToken()
	if err != nil {
		t.Fatalf("GenerateAuthToken() error = %v", err)
	}
	if len(token) != 40 {
		t.Fatalf("token length = %d, want 40", len(token))
	}
}
