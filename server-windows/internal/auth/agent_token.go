package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
)

const (
	// LegacyAgentToken is the shared mock token issued to every device before
	// per-device credentials were implemented. Accepted only during migration.
	LegacyAgentToken = "mock-jwt-token-777"

	// AgentTokenPrefix prefixes freshly minted device secrets.
	AgentTokenPrefix = "win-agt-"

	agentTokenRandomBytes = 32
)

// GenerateAgentToken mints a raw device token and its SHA-256 hex digest.
func GenerateAgentToken() (raw string, hash string, err error) {
	buf := make([]byte, agentTokenRandomBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("read random bytes: %w", err)
	}

	raw = AgentTokenPrefix + hex.EncodeToString(buf)
	return raw, HashAgentToken(raw), nil
}

// HashAgentToken returns the lowercase hex SHA-256 digest of a raw agent token.
func HashAgentToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// IsLegacyAgentToken reports whether raw is the deprecated shared fleet token.
func IsLegacyAgentToken(raw string) bool {
	return strings.TrimSpace(raw) == LegacyAgentToken
}

// IsSecureAgentToken reports whether raw looks like a per-device agent token.
func IsSecureAgentToken(raw string) bool {
	raw = strings.TrimSpace(raw)
	return strings.HasPrefix(raw, AgentTokenPrefix) && len(raw) > len(AgentTokenPrefix)
}

// AllowLegacyAgentTokens reads ALLOW_LEGACY_AGENT_TOKENS (default true).
func AllowLegacyAgentTokens() bool {
	value := strings.TrimSpace(os.Getenv("ALLOW_LEGACY_AGENT_TOKENS"))
	if value == "" {
		return true
	}

	switch strings.ToLower(value) {
	case "0", "false", "no", "off":
		return false
	default:
		return true
	}
}
