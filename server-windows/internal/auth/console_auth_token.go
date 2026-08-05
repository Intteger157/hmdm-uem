package auth

import (
	"fmt"
	"strings"
)

// javaAuthTokenCharset matches PasswordUtil.PASS_CHARS indices 0..61 used by
// PasswordUtil.generateToken() in the Java console login flow.
const javaAuthTokenCharset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

// GenerateAuthToken creates a rotating console auth token stored in users.authtoken.
// The format matches Java PasswordUtil.generateToken (20 characters).
func GenerateAuthToken() (string, error) {
	return generateJavaAuthToken(20)
}

func generateJavaAuthToken(length int) (string, error) {
	if length <= 0 {
		return "", fmt.Errorf("auth token length must be positive")
	}

	var b strings.Builder
	b.Grow(length)
	limit := len(javaAuthTokenCharset)

	for range length {
		index, err := randomIndex(limit)
		if err != nil {
			return "", fmt.Errorf("generate auth token: %w", err)
		}
		b.WriteByte(javaAuthTokenCharset[index])
	}

	return b.String(), nil
}
