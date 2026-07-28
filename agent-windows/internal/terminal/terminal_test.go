//go:build windows

package terminal

import "testing"

func TestBuildDialHeaderSetsBearerToken(t *testing.T) {
	t.Parallel()

	header := buildDialHeader("  secret-token  ")
	if got := header.Get("Authorization"); got != "Bearer secret-token" {
		t.Fatalf("Authorization = %q, want %q", got, "Bearer secret-token")
	}
}

func TestBuildDialHeaderOmitsEmptyToken(t *testing.T) {
	t.Parallel()

	header := buildDialHeader("   ")
	if _, ok := header["Authorization"]; ok {
		t.Fatalf("Authorization header should be absent for empty token, got %q", header.Get("Authorization"))
	}
}
