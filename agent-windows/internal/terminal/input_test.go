//go:build windows

package terminal

import (
	"bytes"
	"testing"
)

func TestNormalizeTerminalInput(t *testing.T) {
	t.Parallel()

	got := normalizeTerminalInput([]byte("x\x7fy"))
	want := []byte("x\x08y")
	if !bytes.Equal(got, want) {
		t.Fatalf("got %q want %q", got, want)
	}

	unchanged := normalizeTerminalInput([]byte("hello"))
	if !bytes.Equal(unchanged, []byte("hello")) {
		t.Fatalf("unexpected mutation: %q", unchanged)
	}
}
