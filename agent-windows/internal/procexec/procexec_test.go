//go:build windows

package procexec

import (
	"context"
	"errors"
	"testing"
	"time"
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

	if InstallTimeoutMessage != "Execution timeout (20m)" {
		t.Fatalf("unexpected timeout message: %q", InstallTimeoutMessage)
	}
	if InstallTimeout != 20*time.Minute {
		t.Fatalf("unexpected install timeout: %s", InstallTimeout)
	}
}
