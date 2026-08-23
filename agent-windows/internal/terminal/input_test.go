//go:build windows

package terminal

import (
	"bytes"
	"testing"
)

func TestNormalizeTerminalInput(t *testing.T) {
	t.Parallel()

	input := []byte("x\x7fy")
	got := normalizeTerminalInput(input)
	if !bytes.Equal(got, input) {
		t.Fatalf("got %q want %q", got, input)
	}
}
