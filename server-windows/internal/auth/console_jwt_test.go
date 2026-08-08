package auth

import (
	"encoding/base64"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testJWTSecret = "20c68f0d9185b1d18cf6add1e8b491fd89529a44"

func TestJavaJJWTSigningKeyMatchesJJWTStringOverload(t *testing.T) {
	key, err := javaJJWTSigningKey(testJWTSecret)
	if err != nil {
		t.Fatalf("javaJJWTSigningKey() error = %v", err)
	}

	want, err := base64.StdEncoding.DecodeString(testJWTSecret)
	if err != nil {
		t.Fatalf("decode secret: %v", err)
	}
	if string(key) != string(want) {
		t.Fatalf("signing key = %q, want Base64-decoded %q", key, want)
	}
}

func TestMintConsoleJWTMatchesJavaShape(t *testing.T) {
	token, err := MintConsoleJWTForUser(testJWTSecret, ConsoleJWTSubject{
		Login:     "global.admin",
		AuthToken: "auth-global",
	}, false)
	if err != nil {
		t.Fatalf("MintConsoleJWTForUser() error = %v", err)
	}

	javaKey, err := javaJJWTSigningKey(testJWTSecret)
	if err != nil {
		t.Fatalf("javaJJWTSigningKey() error = %v", err)
	}

	claims := jwt.MapClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (any, error) {
		return javaKey, nil
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
	if _, hasIAT := claims["iat"]; hasIAT {
		t.Fatalf("iat claim should be omitted to match Java TokenProvider, got %v", claims["iat"])
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
	if len(token) != 20 {
		t.Fatalf("token length = %d, want 20", len(token))
	}
	for _, ch := range token {
		if !stringsContainsRune(javaAuthTokenCharset, ch) {
			t.Fatalf("token contains non-Java charset rune %q", ch)
		}
	}
}

func stringsContainsRune(value string, ch rune) bool {
	for _, candidate := range value {
		if candidate == ch {
			return true
		}
	}
	return false
}
