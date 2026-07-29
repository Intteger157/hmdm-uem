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

var jwtParser = jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodHS512.Alg()}))

// hmacKeyCandidates converts the configured secret into HMAC key material.
//
// The Java server signs with jjwt 0.9, whose signWith(alg, String) overload
// Base64-decodes the configured jwt.secretkey before using it as the HMAC key,
// so that interpretation is tried first. Raw bytes are tried as a fallback for
// deployments that set a literal (non Base64) secret.
func hmacKeyCandidates(secret string) [][]byte {
	candidates := make([][]byte, 0, 2)

	if decoded, err := base64.StdEncoding.DecodeString(secret); err == nil && len(decoded) > 0 {
		candidates = append(candidates, decoded)
	}

	return append(candidates, []byte(secret))
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
