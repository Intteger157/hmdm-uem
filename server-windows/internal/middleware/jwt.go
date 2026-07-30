package middleware

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// ErrMissingToken is returned when a request carries no credentials at all.
var ErrMissingToken = errors.New("missing bearer token")

// adminClaims mirrors the payload the Java TokenProvider issues: the subject is
// the console login and the "token" claim is the user's rotating authToken.
type adminClaims struct {
	jwt.RegisteredClaims
	AuthToken string `json:"token"`
}

var jwtParser = jwt.NewParser(jwt.WithValidMethods([]string{
	jwt.SigningMethodHS512.Alg(),
	jwt.SigningMethodHS256.Alg(),
}))

// hmacKeyCandidates returns the two HMAC key interpretations the Java console
// may have used when signing a JWT.
//
// The default jwt.secretkey is a 40-character hex string. That length is also
// valid Base64, so decoding it yields 30 bytes that look plausible but are
// wrong for deployments where Java signs with the raw UTF-8 secret. Raw bytes
// are therefore tried first; Base64-decoded bytes are the fallback for secrets
// that were intentionally stored encoded.
func hmacKeyCandidates(secret string) [][]byte {
	candidates := make([][]byte, 0, 2)
	candidates = append(candidates, []byte(secret))

	if decoded, err := base64.StdEncoding.DecodeString(secret); err == nil && len(decoded) > 0 {
		// Skip a duplicate when the secret is too short for Base64 to change it.
		if len(decoded) != len(secret) || string(decoded) != secret {
			candidates = append(candidates, decoded)
		}
	}

	return candidates
}

// parseAdminToken verifies the signature and standard claims of a console JWT.
func parseAdminToken(raw, secret string) (*adminClaims, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, ErrMissingToken
	}

	var lastErr error
	for _, key := range hmacKeyCandidates(secret) {
		claims := &adminClaims{}
		_, err := jwtParser.ParseWithClaims(raw, claims, func(*jwt.Token) (any, error) {
			return key, nil
		})
		if err == nil {
			return claims, nil
		}

		// A signature mismatch is the only failure worth retrying with the other
		// key interpretation; expiry or malformed input fails the same way for both.
		if !errors.Is(err, jwt.ErrTokenSignatureInvalid) {
			return nil, err
		}
		lastErr = err
	}

	return nil, fmt.Errorf("verify token signature: %w", lastErr)
}
