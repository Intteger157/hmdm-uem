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

// signLikeJava mints a token the way the Java TokenProvider does for the
// shipped hex secret: HS512 over the raw UTF-8 bytes of jwt.secretkey.
func signLikeJava(t *testing.T, secret, login, authToken string, expiry time.Time) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS512, jwt.MapClaims{
		"sub":   login,
		"token": authToken,
		"exp":   expiry.Unix(),
	})

	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

// signWithBase64DecodedSecret mints a token using the jjwt 0.9 String overload
// semantics, where the configured secret is Base64-decoded before signing.
func signWithBase64DecodedSecret(t *testing.T, secret, login string, expiry time.Time) string {
	t.Helper()

	key, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		t.Fatalf("decode secret: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS512, jwt.MapClaims{
		"sub": login,
		"exp": expiry.Unix(),
	})

	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func TestHmacKeyCandidatesPreferRawBytes(t *testing.T) {
	keys := hmacKeyCandidates(javaSecret)
	if len(keys) != 2 {
		t.Fatalf("len(keys) = %d, want 2", len(keys))
	}
	if string(keys[0]) != javaSecret {
		t.Errorf("keys[0] = %q, want raw secret bytes first", string(keys[0]))
	}

	decoded, err := base64.StdEncoding.DecodeString(javaSecret)
	if err != nil {
		t.Fatalf("decode secret: %v", err)
	}
	if string(keys[1]) != string(decoded) {
		t.Error("keys[1] should be the Base64-decoded secret as fallback")
	}
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

func TestParseAdminTokenAcceptsBase64DecodedSecret(t *testing.T) {
	raw := signWithBase64DecodedSecret(t, javaSecret, "operator", time.Now().Add(time.Hour))

	claims, err := parseAdminToken(raw, javaSecret)
	if err != nil {
		t.Fatalf("parseAdminToken() error = %v, want nil", err)
	}
	if claims.Subject != "operator" {
		t.Errorf("Subject = %q, want %q", claims.Subject, "operator")
	}
}

func TestParseAdminTokenAcceptsLiteralSecret(t *testing.T) {
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

func TestParseAdminTokenAcceptsHS256(t *testing.T) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   "admin",
		"token": "auth-token-1",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})
	raw, err := token.SignedString([]byte(javaSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	claims, err := parseAdminToken(raw, javaSecret)
	if err != nil {
		t.Fatalf("parseAdminToken() error = %v, want nil", err)
	}
	if claims.Subject != "admin" {
		t.Errorf("Subject = %q, want %q", claims.Subject, "admin")
	}
}

func TestParseAdminTokenRejectsUnsupportedAlgorithm(t *testing.T) {
	token := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"sub": "admin",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	//nolint:staticcheck // deliberately constructing an alg=none token for the test
	raw, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	if _, err := parseAdminToken(raw, javaSecret); err == nil {
		t.Fatal("parseAdminToken() accepted alg=none, want rejection")
	}
}

func TestParseAdminTokenRejectsEmptyInput(t *testing.T) {
	if _, err := parseAdminToken("   ", javaSecret); !errors.Is(err, ErrMissingToken) {
		t.Errorf("parseAdminToken() error = %v, want ErrMissingToken", err)
	}
}
