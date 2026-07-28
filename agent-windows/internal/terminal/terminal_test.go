//go:build windows

package terminal

import "testing"

func TestBuildDialHeaderSetsBearerToken(t *testing.T) {
	t.Parallel()

	header := buildDialHeader("  secret-token  ", "  hw-42  ")
	if got := header.Get("Authorization"); got != "Bearer secret-token" {
		t.Fatalf("Authorization = %q, want %q", got, "Bearer secret-token")
	}
	if got := header.Get("X-Device-Id"); got != "hw-42" {
		t.Fatalf("X-Device-Id = %q, want %q", got, "hw-42")
	}
}

func TestBuildDialHeaderOmitsEmptyToken(t *testing.T) {
	t.Parallel()

	header := buildDialHeader("   ", "hw-1")
	if _, ok := header["Authorization"]; ok {
		t.Fatalf("Authorization header should be absent for empty token, got %q", header.Get("Authorization"))
	}
}
