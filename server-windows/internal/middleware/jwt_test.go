package middleware

import (
	"encoding/base64"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// javaSecret is the default jwt.secretkey shipped in the Java server's
// build.properties, kept here so the interop assumption is pinned by a test.
const javaSecret = "20c68f0d9185b1d18cf6add1e8b491fd89529a44"

// signLikeJava mints a token the way the Java TokenProvider does: HS512 over the
// Base64-decoded secret, subject = login, "token" claim = the user's authToken.
func signLikeJava(t *testing.T, secret, login, authToken string, expiry time.Time) string {
	t.Helper()

	key, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		t.Fatalf("decode secret: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS512, jwt.MapClaims{
		"sub":   login,
		"token": authToken,
		"exp":   expiry.Unix(),
	})

	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func TestParseAdminTokenAcceptsJavaSignedToken(t *testing.T) {
	raw := signLikeJava(t, javaSecret, "admin", "auth-token-1", time.Now().Add(time.Hour))

	claims, err := parseAdminToken(raw, javaSecret)
	if err != nil {
		t.Fatalf("parseAdminToken() error = %v, want nil", err)
	}
	if claims.Subject != "admin" {
		t.Errorf("Subject = %q, want %q", claims.Subject, "admin")
	}
	if claims.AuthToken != "auth-token-1" {
		t.Errorf("AuthToken = %q, want %q", claims.AuthToken, "auth-token-1")
	}
}

func TestParseAdminTokenAcceptsLiteralSecret(t *testing.T) {
	// Fallback path for deployments whose secret is not valid Base64.
	const secret = "not-base64-secret!!"
	token := jwt.NewWithClaims(jwt.SigningMethodHS512, jwt.MapClaims{
		"sub": "operator",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	raw, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	claims, err := parseAdminToken(raw, secret)
	if err != nil {
		t.Fatalf("parseAdminToken() error = %v, want nil", err)
	}
	if claims.Subject != "operator" {
		t.Errorf("Subject = %q, want %q", claims.Subject, "operator")
	}
}

func TestParseAdminTokenRejectsWrongSecret(t *testing.T) {
	raw := signLikeJava(t, javaSecret, "admin", "auth-token-1", time.Now().Add(time.Hour))

	if _, err := parseAdminToken(raw, "ZmFrZS1zZWNyZXQtdmFsdWU="); err == nil {
		t.Fatal("parseAdminToken() error = nil, want a signature failure")
	}
}

func TestParseAdminTokenRejectsExpiredToken(t *testing.T) {
	raw := signLikeJava(t, javaSecret, "admin", "auth-token-1", time.Now().Add(-time.Minute))

	_, err := parseAdminToken(raw, javaSecret)
	if err == nil {
		t.Fatal("parseAdminToken() error = nil, want an expiry failure")
	}
	if !errors.Is(err, jwt.ErrTokenExpired) {
		t.Errorf("parseAdminToken() error = %v, want jwt.ErrTokenExpired", err)
	}
}

func TestParseAdminTokenRejectsAlgorithmDowngrade(t *testing.T) {
	key, err := base64.StdEncoding.DecodeString(javaSecret)
	if err != nil {
		t.Fatalf("decode secret: %v", err)
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "admin",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	raw, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	if _, err := parseAdminToken(raw, javaSecret); err == nil {
		t.Fatal("parseAdminToken() accepted HS256, want only HS512")
	}
}

func TestParseAdminTokenRejectsEmptyInput(t *testing.T) {
	if _, err := parseAdminToken("   ", javaSecret); !errors.Is(err, ErrMissingToken) {
		t.Errorf("parseAdminToken() error = %v, want ErrMissingToken", err)
	}
}
