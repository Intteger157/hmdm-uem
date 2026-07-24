//go:build windows

package procexec

import (
	"context"
	"errors"
	"testing"
)

func TestIsTimeout(t *testing.T) {
	t.Parallel()

	if !IsTimeout(context.DeadlineExceeded) {
		t.Fatal("expected DeadlineExceeded to be timeout")
	}
	if IsTimeout(errors.New("other")) {
		t.Fatal("expected non-deadline error to not be timeout")
	}
}

func TestInstallTimeoutMessage(t *testing.T) {
	t.Parallel()

	if InstallTimeoutMessage != "Installation timed out after 15 minutes. Process killed." {
		t.Fatalf("unexpected timeout message: %q", InstallTimeoutMessage)
	}
}
