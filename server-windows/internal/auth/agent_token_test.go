package auth

import (
	"strings"
	"testing"
)

func TestGenerateAgentTokenFormat(t *testing.T) {
	raw, hash, err := GenerateAgentToken()
	if err != nil {
		t.Fatalf("GenerateAgentToken() error = %v", err)
	}
	if !strings.HasPrefix(raw, AgentTokenPrefix) {
		t.Fatalf("raw token = %q, want prefix %q", raw, AgentTokenPrefix)
	}
	if len(hash) != 64 {
		t.Fatalf("hash length = %d, want 64", len(hash))
	}
	if HashAgentToken(raw) != hash {
		t.Fatal("HashAgentToken(raw) mismatch")
	}
}

func TestIsLegacyAgentToken(t *testing.T) {
	if !IsLegacyAgentToken(LegacyAgentToken) {
		t.Fatal("expected legacy token to match")
	}
	raw, _, err := GenerateAgentToken()
	if err != nil {
		t.Fatalf("GenerateAgentToken() error = %v", err)
	}
	if IsLegacyAgentToken(raw) {
		t.Fatal("secure token must not match legacy helper")
	}
}
